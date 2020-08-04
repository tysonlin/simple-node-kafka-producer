// https://github.com/confluentinc/examples/blob/5.5.1-post/clients/cloud/nodejs/config.js

const fs = require('fs');
const readline = require('readline');
const logger = require('./logger');

function readAllLines(path) {    
    return new Promise((resolve, reject) => {
      let lines = [];

      let stream = fs.createReadStream(path);
      stream.on('error', (err) => {
        logger.warn('Read stream err', err);
        resolve([ 'bootstrap.servers=localhost:9092' ]);
      });
      
      let reader = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
      });
      
      reader
        .on('line', (line) => lines.push(line))
        .on('close', () => resolve(lines));
    });
  }

exports.readKafkaConfig = async (path) => {
    const lines = await readAllLines(path);
  
    return lines
      .filter((line) => !/^\s*?#/.test(line))
      .map((line) => line
        .split('=')
        .map((s) => s.trim()))
      .reduce((config, [k, v]) => {
        config[k] = v;
        return config;
      }, {});
  };