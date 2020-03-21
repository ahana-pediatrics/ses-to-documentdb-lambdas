# SES to DocumentDB Lambda

This is a simple Lambda that takes SES events (via SNS) and dumps them into a DocumentDB

## Building and packaging

This should be pretty easy to build:

```
npm install
npm run build
```

Next, download the AWS CA bundle. It should be here:

https://s3.amazonaws.com/rds-downloads/rds-combined-ca-bundle.pem

Make sure it is in this directory.

```
npm run package
```

This will create a lambda.zip file ready for uploading

## AWS Setup

The setup instructions will assume that you have a VPC set up.

If you don't then a) you really should and b) there's a default VPC, so use that if you're not going to create your own.

### SNS

The first step is to set up an SNS topic for SES notifications.

- Go to SNS > Topics
- Click "Create topic"
- Give it a sensible name
- All other settings are at your discretion, but the defaults are fine

### SES

I'm going to assume that you have this set up already. Setting up SES is beyond the scope of this repo.

You need to set up SNS notifications for your domain(s).

- Go to SES > Domains
- Select your domain and click "View Details"
- Open up the Notifications section and click "Edit Configuration"
- Connect "Bounces", "Complaints" and "Deliveries" to your SNS topic from above
- You can choose whether to include original headers

## DocumentDB

Now, you need to create a DocumentDB cluster and instance.

- Go to Amazon DocumentDB > Clusters
- Create a Cluster. How you configure it is mostly up to you, but
- Click "Show Advanced Settings"
- Put it in your desired VPC, Subnet Group and Security Group.
- Take note of the username and password that you set
- All other settings are up to you; then click "Create cluster"
- Go get a drink, while the cluster and instance are spinning up
- Go to DocumentDB > Instance > <your instance name>
- Click Configuration
- Take note of the Instance Endpoint

## IAM

You're going to need to create an IAM role for your lambda.

First, we need to create a Policy

- Go to IAM > Policies
- Click Create Policy
- Click on JSON
- Add the following JSON

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SesLambdaPolicy1",
      "Effect": "Allow",
      "Action": [
        "ec2:CreateNetworkInterface",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DeleteNetworkInterface"
      ],
      "Resource": "*"
    }
  ]
}
```

- Click on Review Policy
- Give it a sensible name
- Click Create Policy

Next, you can create the role:

- Go to IAM > Roles
- Click on Create Role
- Click on AWS Service and select Lambda
- Click Next: Permissions
- Find the `AWSLambdaBasicExecutionRole` role and select it
- Find the role that you created and select it too
- Click Next: Tags and add any tags you want
- Click Next: Review
- Give the Role a sensible name and create it

## Lambda

Now it's time to create your Lambda

- Go to Lambda > Functions
- Click Create Function
- Select Author from scratch
- Give it a sensible name
- Select the Node.js 12.x runtime
- Open the "Choose or create an execution role"
- Use an existing role and select the one you just created
- Click Create function
- In the Designer, click Add trigger
- Select SNS as your trigger
- Select the topic you created for SES notifications
- It's up to you whether you want to enable this trigger now or later, but remember to enable it at some point
- In the Function Code part of the lambda config, change the Code entry type to "Upload a .zip file"
- Upload the lambda.zip file you created when you ran `npm run package`
- Once uploaded, scroll down to VPC and click Edit
- Set up your VPC according the choices you made above for the DocumentDB
- Next, edit the environment variables:
  - **MONGODB_PASS**: The DocumentDB password
  - **MONGODB_URI**: The DocumentDB instance endpoint
  - **MONGODB_USER**: The DocumentDB username
- Go to the top of the Lambda function page, click on the Test Event dropdown and select "Configure test events"
- Create a new test event call "SesDeliveryNotification"
- Use the following JSON:

```json
{
  "Records": [
    {
      "EventSource": "aws:sns",
      "EventVersion": "1.0",
      "EventSubscriptionArn": "arn:aws:sns:us-west-2:{{{accountId}}}:ExampleTopic",
      "Sns": {
        "Type": "Notification",
        "MessageId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxx",
        "TopicArn": "arn:aws:sns:us-west-2:{{{accountId}}}:your-topic",
        "Message": "{\"notificationType\":\"Delivery\",\"mail\":{\"timestamp\":\"2020-03-20T16:47:07.167Z\",\"source\":\"test@example.com\",\"sourceArn\":\"arn:aws:ses:us-west-2:{{{accountId}}}:identity/example.com\",\"sourceIp\":\"0.0.0.0\",\"sendingAccountId\":\"{{{accountId}}}\",\"messageId\":\"xxxxxx-xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx-000000\",\"destination\":[\"recipient@example.com\"]},\"delivery\":{\"timestamp\":\"2020-03-20T16:47:11.544Z\",\"processingTimeMillis\":4377,\"recipients\":[\"recipient@example.com\"],\"smtpResponse\":\"250 2.0.0 xxxxxxxx mail accepted for delivery\",\"remoteMtaIp\":\"0.0.0.0\",\"reportingMTA\":\"b237-74.smtp-out.us-west-2.amazonses.com\"}}",
        "Timestamp": "2020-03-20T16:47:11.615Z",
        "SignatureVersion": "1",
        "Signature": "xxxxx",
        "SigningCertURL": "https://sns.us-west-2.amazonaws.com/dummy.pem",
        "UnsubscribeURL": "https://sns.us-west-2.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:us-west-2:{{{accountId}}}:dummy:3d4712ad-a55d-4718-81fc-35feb5036c2d"
      }
    }
  ]
}
```

- Click Test. After a few seconds, you should see that everything is working

# Contributing

AWS is quite the maze, so if you find any edge cases or errors in what I've written above, I would welcome a PR

If you have suggestions on improving the code that you think would be broadly applicable, I also welcome PRs.

# Seeing your data

Really, this depends a lot on your VPC setup. Install a mongo client and point it at your DocumentDB.
It will be something like:

```
mongo --tls --host <your cluster endpoint> --tlsCAFile rds-combined-ca-bundle.pem --username <your cluster username> --password <your cluster password>
```

## macOS

If you're on a Mac, it's gonna complain about the pem file because the validity time of the certificates is too long. In this case, you can use `--tlsAllowInvalidCertificates` instead of the other `--tls*` parameters... not idea, but I don't know a better solution at the moment.
