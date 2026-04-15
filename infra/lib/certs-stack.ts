import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { Construct } from "constructs";

interface Props extends StackProps {
  apexDomain: string;                   // e.g. business-board-game.com
  apiDomain: string;                    // e.g. api.business-board-game.com
  /**
   * When true the stack creates an ACM cert for the apex + www — must be deployed
   * to us-east-1 (CloudFront only accepts certs from that region).
   * When false, creates the ALB cert for the api subdomain in the stack's own region.
   */
  forCloudFront: boolean;
}

/**
 * DNS validation is manual because the zone lives at Cloudflare. CDK will
 * create the cert and CloudFormation will wait (up to ~60 min) for the user
 * to add the validation CNAME records — the record name/value pair is
 * surfaced via the ACM console, not via stack outputs (AWS doesn't expose
 * the resource-record-name attribute on the CloudFormation construct).
 */
export class CertsStack extends Stack {
  public readonly certificate: acm.Certificate;
  public readonly certificateArn: string;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    if (props.forCloudFront) {
      this.certificate = new acm.Certificate(this, "CloudFrontCert", {
        domainName: props.apexDomain,
        subjectAlternativeNames: [`www.${props.apexDomain}`],
        validation: acm.CertificateValidation.fromDns()
      });
    } else {
      this.certificate = new acm.Certificate(this, "AlbCert", {
        domainName: props.apiDomain,
        validation: acm.CertificateValidation.fromDns()
      });
    }
    this.certificateArn = this.certificate.certificateArn;

    new CfnOutput(this, "CertificateArn", { value: this.certificateArn });
    new CfnOutput(this, "ValidateDnsNote", {
      value: "Check the ACM console for the CNAME validation records to paste into Cloudflare DNS."
    });
  }
}
