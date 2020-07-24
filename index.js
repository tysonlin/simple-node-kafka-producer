// Environment Variables
// KAFKA_CONFIG_PATH: Path to Kafka .config, defaults to: 'localhost.config'
// KAFKA_PRODUCE_TOPIC: Topic name for POST /produce, defaults to: 'test'
// KAFKA_PRODUCE_ENCRYPTED_TOPIC: Topic name for POST /produce, same as KAFKA_PRODUCE_TOPIC if not configured
// BROKER_ENDPOINT: Kafka broker endpoint

// for Confluent cloud
// CLUSTER_API_KEY: ccloud key
// CLUSTER_API_SECRET: ccloud secret

// for encryption
// CRYPTO_KEY: Crypto key
// CRYPTO_IV: Crypto IV

const express = require("express");
const app = express();
const promBundle = require("express-prom-bundle");
const metricsMiddleware = promBundle({
    includeMethod: true,
    includePath: true,
    metricType: "summary"
});

// kafka producer init
let producer;

(async () => {
    let config = await require('./config').readKafkaConfig(process.env.KAFKA_CONFIG_PATH || 'localhost.config');
    producer = await require('./producer').createProducer(config, (err, report) => {
        if (err) {
          console.warn('Error producing', err)
        } else {
          const {topic, partition, value} = report;
          console.log(`Successfully produced record to topic "${topic}" partition ${partition} ${value}`);
        }
      });
})();

// health endpoint
// calls to this route will not appear in metrics
app.get("/health", (req, res) => res.json({"status":"healthy"}));

// register middlewares
app.use(express.json()) 
app.use(metricsMiddleware);

// POST /produce
// post raw message to Kafka
// calls to this route will appear in metrics
app.post("/produce", (req, res) => {
    let key = req.body.key || 'default-key';
    let value = req.body.value || { "default": "message" };
    let bufferedValue = Buffer.from(JSON.stringify(value), 'utf-8');
    
    producer.produce(process.env.KAFKA_PRODUCE_TOPIC || 'test', -1, bufferedValue, key);
    producer.flush();

    res.status(202).json({ postedMessage: { key, value } });
});

const crypto = require('crypto');
const cryptoKey = process.env.CRYPTO_KEY || crypto.randomBytes(32);
const cryptoIv = process.env.CRYPTO_IV || crypto.randomBytes(16);

// POST /produceEncrypted
// post encryped message to Kafka
// calls to this route will appear in metrics
app.post("/produceEncrypted", (req, res) => {
    let key = req.body.key || 'default-key';
    let value = req.body.value || { "default": "message" };

    let algorithm = req.body.algorithm || 'aes-256-cbc';

    let stringifiedValue = JSON.stringify(value);

    // do some encrpytion
    let cipher = crypto.createCipheriv(algorithm, Buffer.from(cryptoKey), cryptoIv);
    let encrypted = cipher.update(stringifiedValue);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    let bufferedEncryptedResult = Buffer.from(encrypted.toString('hex'));
    
    producer.produce(process.env.KAFKA_PRODUCE_ENCRYPTED_TOPIC || 
        process.env.KAFKA_PRODUCE_TOPIC || 'test', 
        -1, bufferedEncryptedResult, key);
    producer.flush();

    res.status(202).json({ postedMessage: { key, value } });
});

const server = app.listen(3000);

// graceful termination
function cleanup() {
    server.close(() => {
        producer.disconnect(() => {
            process.exit(0);
        });
    });
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);