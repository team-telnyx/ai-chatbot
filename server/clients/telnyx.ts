import axios from 'axios';

export const telnyx = axios.create({
  baseURL: 'https://api.telnyx.com/v2',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
  },
});

export const us_central_1 = axios.create({
  baseURL: 'https://us-central-1.telnyxcloudstorage.com',
  headers: {
    Authorization: `AWS4-HMAC-SHA256 Credential=${process.env.TELNYX_API_KEY}/20221129/us-east-1/s3/aws4_request,SignedHeaders=host;range;x-amz-date,Signature=d82d11938fe5edf39a778ec710ac79899bae1d9a46ae36607be30fb55f655a3c`,
    'Content-Type': 'application/json',
  },
});

export const us_east_1 = axios.create({
  baseURL: 'https://us-east-1.telnyxcloudstorage.com',
  headers: {
    Authorization: `AWS4-HMAC-SHA256 Credential=${process.env.TELNYX_API_KEY}/20221129/us-east-1/s3/aws4_request,SignedHeaders=host;range;x-amz-date,Signature=d82d11938fe5edf39a778ec710ac79899bae1d9a46ae36607be30fb55f655a3c`,
    'Content-Type': 'application/json',
  },
});

export const us_west_1 = axios.create({
  baseURL: 'https://us-east-1.telnyxcloudstorage.com',
  headers: {
    Authorization: `AWS4-HMAC-SHA256 Credential=${process.env.TELNYX_API_KEY}/20221129/us-east-1/s3/aws4_request,SignedHeaders=host;range;x-amz-date,Signature=d82d11938fe5edf39a778ec710ac79899bae1d9a46ae36607be30fb55f655a3c`,
    'Content-Type': 'application/json',
  },
});
