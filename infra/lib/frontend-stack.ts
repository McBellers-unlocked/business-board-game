import { Stack, StackProps, CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { Construct } from "constructs";

interface Props extends StackProps {
  apiUrl: string;
  userPoolId: string;
  userPoolClientId: string;
  /** us-east-1 ACM cert ARN for the apex + www. Required when `customDomains` is set. */
  cloudfrontCertificateArn?: string;
  /** e.g. ["business-board-game.com","www.business-board-game.com"] */
  customDomains?: string[];
  /** ALB DNS name — when provided, `/api/*` is routed to the ALB via CloudFront to avoid mixed-content blocks. */
  albDomainName?: string;
}

/**
 * Frontend hosting: S3 static bucket + CloudFront distribution (serverless SPA).
 * Deploys the contents of client/dist via `aws s3 sync` during release.
 * Chosen over Amplify because CDK-driven S3+CloudFront is simpler and avoids the
 * Amplify-specific pipeline wiring; you can switch to Amplify if preferred.
 */
export class FrontendStack extends Stack {
  public readonly distributionDomain: string;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    // Private bucket — CloudFront reads via Origin Access Control, not website hosting.
    const bucket = new s3.Bucket(this, "SiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true
    });

    const useCustom = props.cloudfrontCertificateArn && props.customDomains && props.customDomains.length > 0;

    // Optional API proxy behaviour: CloudFront hits the ALB over HTTP so the
    // browser sees same-origin HTTPS and avoids mixed-content blocks.
    const additionalBehaviors: Record<string, cloudfront.BehaviorOptions> = {};
    if (props.albDomainName) {
      additionalBehaviors["/api/*"] = {
        origin: new origins.HttpOrigin(props.albDomainName, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          httpPort: 80
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        // Disable caching of API responses
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        // Forward all headers + query string + cookies to the origin
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        compress: false
      };
    }

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED
      },
      additionalBehaviors,
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html" },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html" }
      ],
      ...(useCustom
        ? {
            domainNames: props.customDomains!,
            certificate: acm.Certificate.fromCertificateArn(this, "CfCert", props.cloudfrontCertificateArn!)
          }
        : {})
    });

    this.distributionDomain = distribution.distributionDomainName;

    new CfnOutput(this, "SiteBucketName", { value: bucket.bucketName });
    new CfnOutput(this, "DistributionDomain", { value: this.distributionDomain });
    new CfnOutput(this, "ApiUrl", { value: props.apiUrl });
    new CfnOutput(this, "UserPoolId", { value: props.userPoolId });
    new CfnOutput(this, "UserPoolClientId", { value: props.userPoolClientId });
  }
}
