#!/usr/bin/env node
import { App, Environment } from "aws-cdk-lib";
import { NetworkStack } from "../lib/network-stack.js";
import { CognitoStack } from "../lib/cognito-stack.js";
import { BackendStack } from "../lib/backend-stack.js";
import { FrontendStack } from "../lib/frontend-stack.js";
import { CertsStack } from "../lib/certs-stack.js";

const app = new App();

const account = process.env.CDK_DEFAULT_ACCOUNT;
const primaryRegion = process.env.CDK_DEFAULT_REGION ?? "eu-west-2";

const env: Environment = { account, region: primaryRegion };
const usEast1Env: Environment = { account, region: "us-east-1" };

const appName = app.node.tryGetContext("appName") ?? "dcl";
const apexDomain = app.node.tryGetContext("apexDomain") as string | undefined;
const apiDomain = app.node.tryGetContext("apiDomain") as string | undefined;
const enableCerts = app.node.tryGetContext("enableCerts") === "true" || app.node.tryGetContext("enableCerts") === true;
const cloudfrontCertArn = app.node.tryGetContext("cloudfrontCertArn") as string | undefined;
const albCertArn = app.node.tryGetContext("albCertArn") as string | undefined;

const frontendOrigins = apexDomain
  ? [`https://${apexDomain}`, `https://www.${apexDomain}`]
  : undefined;

// --- Core stacks ---
const network = new NetworkStack(app, `${appName}-network`, { env });
const cognito = new CognitoStack(app, `${appName}-cognito`, { env });

// --- Optional cert stacks ---
if (enableCerts && apexDomain && apiDomain) {
  new CertsStack(app, `${appName}-cert-cloudfront`, {
    env: usEast1Env,
    apexDomain,
    apiDomain,
    forCloudFront: true,
    crossRegionReferences: true
  });
  new CertsStack(app, `${appName}-cert-alb`, {
    env,
    apexDomain,
    apiDomain,
    forCloudFront: false,
    crossRegionReferences: true
  });
}

const backend = new BackendStack(app, `${appName}-backend`, {
  env,
  vpc: network.vpc,
  userPool: cognito.userPool,
  userPoolClient: cognito.userPoolClient,
  albCertificateArn: albCertArn,
  apiDomain,
  frontendOrigins,
  crossRegionReferences: true
});

new FrontendStack(app, `${appName}-frontend`, {
  env,
  apiUrl: backend.apiUrl,
  userPoolId: cognito.userPool.userPoolId,
  userPoolClientId: cognito.userPoolClient.userPoolClientId,
  cloudfrontCertificateArn: cloudfrontCertArn,
  customDomains: apexDomain ? [apexDomain, `www.${apexDomain}`] : undefined,
  albDomainName: backend.albDnsName,
  crossRegionReferences: true
});
