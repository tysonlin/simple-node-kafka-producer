// https://github.com/confluentinc/examples/blob/5.5.1-post/clients/cloud/nodejs/producer.js

const Kafka = require('node-rdkafka');

const logger = require('./logger');

let producer;

exports.createProducer = (config, onDeliveryReport) => {
    let envDefaultOptions = {
        'bootstrap.servers': process.env.BROKER_ENDPOINT || config['bootstrap.servers'],
        'sasl.username': process.env.CLUSTER_API_KEY || config['sasl.username'],
        'sasl.password': process.env.CLUSTER_API_SECRET || config['sasl.password'],
        'security.protocol': config['security.protocol'] || 
                            (process.env.CLUSTER_API_KEY && process.env.CLUSTER_API_SECRET)? 'SASL_SSL' :'PLAINTEXT',
        'sasl.mechanisms': config['sasl.mechanisms'] || 'PLAIN',
        'dr_msg_cb': config['dr_msg_cb'] || true,
        'statistics.interval.ms': config['statistics.interval.ms'] || 1000,
      };

    let producerOptions = Object.assign(config, envDefaultOptions);

    logger.debug(`Creating producer with config ${JSON.stringify(producerOptions)}`);

    producer = new Kafka.Producer(producerOptions);
  
    return new Promise((resolve, reject) => {
      producer
        .on('ready', () => {
            logger.debug('Producer ready!');
            resolve(producer);
        })
        .on('delivery-report', onDeliveryReport)
        .on('error', (err) => {
          logger.warn('event.error', err);
          reject(err);
        });
      producer.connect();
    });
};