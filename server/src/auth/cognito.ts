import { CognitoJwtVerifier } from "aws-jwt-verify";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  ResendConfirmationCodeCommand
} from "@aws-sdk/client-cognito-identity-provider";
import { config } from "../config.js";

// Lazy-initialised so dev mode doesn't trigger network calls.
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;
let client: CognitoIdentityProviderClient | null = null;

function getVerifier() {
  if (verifier) return verifier;
  if (!config.cognitoUserPoolId || !config.cognitoClientId) {
    throw new Error("Cognito is not configured");
  }
  verifier = CognitoJwtVerifier.create({
    userPoolId: config.cognitoUserPoolId,
    tokenUse: "id",
    clientId: config.cognitoClientId
  });
  return verifier;
}

function getClient() {
  if (client) return client;
  client = new CognitoIdentityProviderClient({ region: config.awsRegion });
  return client;
}

export interface CognitoUser {
  sub: string;
  email: string;
}

export async function verifyCognitoIdToken(idToken: string): Promise<CognitoUser> {
  const v = getVerifier();
  const payload = await v.verify(idToken);
  return { sub: payload.sub as string, email: payload.email as string };
}

export async function cognitoSignUp(email: string, password: string, displayName: string) {
  const c = getClient();
  const cmd = new SignUpCommand({
    ClientId: config.cognitoClientId,
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: "email", Value: email },
      { Name: "name", Value: displayName }
    ]
  });
  return c.send(cmd);
}

export async function cognitoConfirmSignUp(email: string, code: string) {
  const c = getClient();
  const cmd = new ConfirmSignUpCommand({
    ClientId: config.cognitoClientId,
    Username: email,
    ConfirmationCode: code
  });
  return c.send(cmd);
}

export async function cognitoInitiateAuth(email: string, password: string) {
  const c = getClient();
  const cmd = new InitiateAuthCommand({
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: config.cognitoClientId,
    AuthParameters: { USERNAME: email, PASSWORD: password }
  });
  return c.send(cmd);
}

export async function cognitoForgotPassword(email: string) {
  return getClient().send(
    new ForgotPasswordCommand({ ClientId: config.cognitoClientId, Username: email })
  );
}

export async function cognitoConfirmForgotPassword(email: string, code: string, newPassword: string) {
  return getClient().send(
    new ConfirmForgotPasswordCommand({
      ClientId: config.cognitoClientId,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword
    })
  );
}

export async function cognitoResendConfirmation(email: string) {
  return getClient().send(
    new ResendConfirmationCodeCommand({ ClientId: config.cognitoClientId, Username: email })
  );
}
