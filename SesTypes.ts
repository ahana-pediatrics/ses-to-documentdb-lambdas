type MailObject = {
  timestamp: string;
  messageId: string;
  source: string;
  sourceArn: string;
  sourceIp: string;
  sendingAccountId: string;
  destination: string[];
  headersTruncated: boolean;
  headers: {name: string; value: string}[];
  commonHeaders: Record<string, string | string[]>;
};

type DeliveryData = {
  timestamp: string;
  processingTimeMillis: number;
  recipients: string[];
  smtpResponse: string;
  reportingMTA: string;
  remoteMtaIp: string;
};

type Recipient = {
  emailAddress: string;
};

type BouncedRecipient = Recipient & {
  action?: string;
  status?: string;
  diagnosticCode?: string;
};

type BounceData = {
  bounceType: string;
  bounceSubType: string;
  bouncedRecipients: BouncedRecipient[];
  timestamp: string;
  feedbackId: string;
  remoteMtaIp?: string;
  reportingMTA?: string;
};

type ComplaintData = {
  complainedRecipients: Recipient[];
  timestamp: string;
  feedbackId: string;
  complaintSubType: string;
  userAgent?: string;
  complaintFeedbackType?: string;
  arrivalDate?: string;
};

export type SesNotification =
  | {
      notificationType: 'Delivery';
      mail: MailObject;
      delivery: DeliveryData;
    }
  | {
      notificationType: 'Bounce';
      mail: MailObject;
      bounce: BounceData;
    }
  | {
      notificationType: 'Complaint';
      mail: MailObject;
      complaint: ComplaintData;
    };
