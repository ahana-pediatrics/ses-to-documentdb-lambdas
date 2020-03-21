import { Handler, SNSEvent } from "aws-lambda";
import { readFileSync } from "fs";
import { MongoClient } from "mongodb";
import { SesNotification } from "./SesTypes";

const MONGODB_URI = process.env.MONGODB_URI ?? "";
const MONGODB_USER = process.env.MONGODB_USER ?? "";
const MONGODB_PASS = process.env.MONGODB_PASS ?? "";

const connectionUri = `mongodb://${MONGODB_USER}:${MONGODB_PASS}@${MONGODB_URI}`;

const cachedDb: Map<string, MongoClient> = new Map();

const sslCA = [readFileSync(__dirname + "/rds-combined-ca-bundle.pem")];

const connectToDatabase = async (uri: string): Promise<MongoClient | null> => {
  console.log("=> connect to database");

  if (!cachedDb.has(uri)) {
    console.log("=> creating connection...");
    const connection = await MongoClient.connect(uri, {
      useUnifiedTopology: true,
      ssl: true,
      replicaSet: "rs0",
      readPreference: "secondaryPreferred",
      sslCA
    }).then(c => c);

    cachedDb.set(uri, connection);
    console.log("=> connection created...");
  }

  return cachedDb.get(uri) ?? null;
};

export const handler: Handler<SNSEvent> = async (event: SNSEvent) => {
  const { Records } = event;

  const client = await connectToDatabase(connectionUri);
  if (client === null) {
    console.error("Could not connect to Mongo");
    return "Failed";
  }

  const db = client.db("ses-notifications");

  await Promise.all(
    Records.map(async record => {
      const message = record.Sns.Message;
      const notification: SesNotification = JSON.parse(message);
      const { mail } = notification;
      console.log("From SNS:", message);
      console.log(`Got notification of type: ${notification.notificationType}`);
      const { insertedId: mailObjectId } = await db
        .collection("mail")
        .insertOne(mail);
      console.log(` => create mail: ${mailObjectId}`);
      if (notification.notificationType === "Delivery") {
        const { delivery } = notification;
        const {
          timestamp,
          processingTimeMillis,
          recipients,
          smtpResponse,
          reportingMTA,
          remoteMtaIp
        } = delivery;
        await db.collection("deliveries").insertOne({
          mailObjectId,
          timestamp,
          processingTimeMillis,
          recipients,
          smtpResponse,
          reportingMTA,
          remoteMtaIp
        });
      } else if (notification.notificationType === "Bounce") {
        const { bounce } = notification;
        const {
          bounceType,
          bounceSubType,
          bouncedRecipients,
          timestamp,
          feedbackId,
          ...additional
        } = bounce;
        await db.collection("bounces").insertOne({
          mailObjectId,
          bounceType,
          bounceSubType,
          bouncedRecipients,
          timestamp,
          feedbackId,
          additional
        });
      } else if (notification.notificationType === "Complaint") {
        const { complaint } = notification;
        const {
          complainedRecipients,
          timestamp,
          feedbackId,
          complaintSubType,
          ...additional
        } = complaint;
        db.collection("complaints").insertOne({
          mailObjectId,
          complainedRecipients,
          timestamp,
          feedbackId,
          complaintSubType,
          additional
        });
      }

      return message;
    })
  );

  return `Done with ${Records.length} records`;
};
