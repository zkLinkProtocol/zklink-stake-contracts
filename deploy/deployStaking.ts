import { deployContract } from './utils';

export default async function () {
  await deployContract(
    'Staking',
    [process.env.ZKL_ADDRESS],
    {
      noVerify: false,
      upgradable: true,
      kind: 'uups',
      unsafeAllow: ['constructor', 'state-variable-immutable'],
    },
    [],
  );
}
