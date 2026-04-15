import { Stack, StackProps, Duration, CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr_assets from "aws-cdk-lib/aws-ecr-assets";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Props extends StackProps {
  vpc: ec2.Vpc;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  /** Optional ACM cert ARN (in same region) — if provided, adds an HTTPS listener on port 443 with HTTP redirect. */
  albCertificateArn?: string;
  /** Optional api domain string — used in CORS allowlist for the backend. */
  apiDomain?: string;
  /** Optional frontend origins (apex + www). Used in CORS allowlist. */
  frontendOrigins?: string[];
}

/**
 * Single backend stack that owns RDS + Fargate + ALB + S3.
 * Keeping these together avoids CDK cross-stack SG reference cycles that arise
 * when the ALB's auto-created SG tries to ingress into the Fargate service SG.
 */
export class BackendStack extends Stack {
  public readonly apiUrl: string;
  public readonly albDnsName: string;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    // ---- RDS Postgres ----
    const dbSg = new ec2.SecurityGroup(this, "DbSg", {
      vpc: props.vpc,
      description: "DCL Postgres SG",
      allowAllOutbound: true
    });
    const db = new rds.DatabaseInstance(this, "Postgres", {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.of("16.13", "16") }),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      securityGroups: [dbSg],
      databaseName: "dcl",
      credentials: rds.Credentials.fromGeneratedSecret("dcl"),
      backupRetention: Duration.days(7),
      deletionProtection: false,
      // DESTROY during iteration. Switch to RETAIN once the pipeline is stable.
      removalPolicy: RemovalPolicy.DESTROY,
      storageEncrypted: true,
      // Skip final snapshot so stack delete doesn't wedge on unnamed snapshots.
      // Remove this once we move to production.
      deleteAutomatedBackups: true
    });
    const dbSecret = db.secret!;

    // ---- S3 exports bucket ----
    const exportsBucket = new s3.Bucket(this, "ExportsBucket", {
      lifecycleRules: [{ expiration: Duration.days(365) }],
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true
    });

    // ---- Fargate service ----
    const cluster = new ecs.Cluster(this, "ApiCluster", { vpc: props.vpc });

    const image = new ecr_assets.DockerImageAsset(this, "ServerImage", {
      // Build context is the monorepo root so the Dockerfile can COPY shared + server
      directory: path.resolve(__dirname, "..", ".."),
      file: "server/Dockerfile",
      platform: ecr_assets.Platform.LINUX_AMD64,
      exclude: ["node_modules", "**/node_modules", ".pg-data", "cdk.out", "*.docx", ".git", "**/dist"]
    });

    const jwtSecret = new secretsmanager.Secret(this, "TeamJwtSecret", {
      generateSecretString: { passwordLength: 48, excludePunctuation: true }
    });

    const taskDef = new ecs.FargateTaskDefinition(this, "ApiTask", {
      cpu: 512,
      memoryLimitMiB: 1024
    });

    taskDef.addContainer("api", {
      image: ecs.ContainerImage.fromDockerImageAsset(image),
      portMappings: [{ containerPort: 4000 }],
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "dcl-api" }),
      environment: {
        NODE_ENV: "production",
        PORT: "4000",
        AWS_REGION: this.region,
        COGNITO_USER_POOL_ID: props.userPool.userPoolId,
        COGNITO_CLIENT_ID: props.userPoolClient.userPoolClientId,
        S3_EXPORTS_BUCKET: exportsBucket.bucketName,
        AUTH_DEV_MODE: "false",
        PGSSL: "true",
        CLIENT_ORIGIN: (props.frontendOrigins ?? []).join(",") || "*"
      },
      secrets: {
        DB_USER: ecs.Secret.fromSecretsManager(dbSecret, "username"),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, "password"),
        DB_HOST: ecs.Secret.fromSecretsManager(dbSecret, "host"),
        DB_PORT: ecs.Secret.fromSecretsManager(dbSecret, "port"),
        DB_NAME: ecs.Secret.fromSecretsManager(dbSecret, "dbname"),
        TEAM_JWT_SECRET: ecs.Secret.fromSecretsManager(jwtSecret)
      }
    });

    exportsBucket.grantReadWrite(taskDef.taskRole);

    const serviceSg = new ec2.SecurityGroup(this, "ApiServiceSg", {
      vpc: props.vpc,
      description: "DCL API Fargate service SG",
      allowAllOutbound: true
    });
    dbSg.addIngressRule(serviceSg, ec2.Port.tcp(5432), "API to Postgres");

    const service = new ecs.FargateService(this, "ApiService", {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      securityGroups: [serviceSg],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      assignPublicIp: false,
      circuitBreaker: { rollback: true }
    });

    const scaling = service.autoScaleTaskCount({ minCapacity: 1, maxCapacity: 4 });
    scaling.scaleOnCpuUtilization("CpuScaling", {
      targetUtilizationPercent: 65,
      scaleInCooldown: Duration.seconds(120),
      scaleOutCooldown: Duration.seconds(60)
    });

    // ---- ALB ----
    const alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      vpc: props.vpc,
      internetFacing: true
    });

    if (props.albCertificateArn) {
      // HTTPS listener + HTTP redirect
      const cert = acm.Certificate.fromCertificateArn(this, "AlbCertRef", props.albCertificateArn);
      const httpsListener = alb.addListener("HttpsListener", {
        port: 443,
        certificates: [cert],
        open: true
      });
      httpsListener.addTargets("ApiTargets", {
        port: 4000,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targets: [service],
        healthCheck: {
          path: "/api/health",
          healthyHttpCodes: "200",
          interval: Duration.seconds(30)
        }
      });
      // Reuse the logical ID "HttpListener" (same as the non-TLS branch) so
      // CloudFormation does an in-place update of the existing port-80 listener
      // rather than trying to create a new one alongside the old (port conflict).
      alb.addListener("HttpListener", {
        port: 80,
        defaultAction: elbv2.ListenerAction.redirect({ protocol: "HTTPS", port: "443", permanent: true })
      });
      this.apiUrl = props.apiDomain ? `https://${props.apiDomain}` : `https://${alb.loadBalancerDnsName}`;
    } else {
      const listener = alb.addListener("HttpListener", { port: 80, open: true });
      listener.addTargets("ApiTargets", {
        port: 4000,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targets: [service],
        healthCheck: {
          path: "/api/health",
          healthyHttpCodes: "200",
          interval: Duration.seconds(30)
        }
      });
      this.apiUrl = `http://${alb.loadBalancerDnsName}`;
    }

    this.albDnsName = alb.loadBalancerDnsName;
    new CfnOutput(this, "ApiUrl", { value: this.apiUrl });
    new CfnOutput(this, "AlbDnsName", { value: alb.loadBalancerDnsName });
    new CfnOutput(this, "ExportsBucketName", { value: exportsBucket.bucketName });
    new CfnOutput(this, "DbSecretArn", { value: dbSecret.secretArn });
    new CfnOutput(this, "DbEndpoint", { value: db.instanceEndpoint.hostname });
  }
}
