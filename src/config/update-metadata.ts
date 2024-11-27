import axios from 'axios';
import config from './metadata.json';

async function main() {
  const keys = [
    'c095a79edcc5d87740063dbd53d18e0cf98ee2129a7509b0883492cca42a517e',
    '62c50fa12beb648089575e9fa8804bcf2534142560eaa6c85bae6783efc664c8',
  ];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const keyProd = [
    '2714ef65b4f14c5c74b1d817eefcc1a994835de3034bfd2d5e2d3e8abbbadf32',
    '36a9cbbd16466f64a4d98bc71e438a90c18b5c01741ac2f2eb621365a416e9f7',
  ];
  for (const key of keys) {
    if (config[key] == null) {
      console.log(`config[${key}] is null`);
      continue;
    }
    let response;
    try {
      response = await axios.post(
        `http://0.0.0.0:5001/metadata/${key}`,
        JSON.stringify(config[key]),
      );
      console.log(`${key} ${JSON.stringify(response.data)}`);
    } catch (error) {
      console.log(`error ${key}: ${JSON.stringify(error.response.data)}`);
    }
  }
}

main();
