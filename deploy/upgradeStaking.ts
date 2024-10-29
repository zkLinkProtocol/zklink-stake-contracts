import { upgradeContract } from './utils';

export default async function () {
  await upgradeContract('Staking', [process.env.ZKL_ADDRESS], {
    noVerify: false,
    upgradable: true,
    unsafeAllow: ['constructor', 'state-variable-immutable'],
  });
}
