const { S3Client } = require('@aws-sdk/client-s3');
const config = process.env;

const s3Client = new S3Client({
    region: config.REGION,
    endpoint: config.bucket_endpoint,
    credentials: {
        accessKeyId: config.ACCESS_KEY_Id,
        secretAccessKey: config.SECRETACCESSKEY
    }
});

module.exports = s3Client;
