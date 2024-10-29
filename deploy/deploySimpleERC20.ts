import { deployContract } from './utils';

export default async function () {
  const contractArtifactName = 'SimpleERC20Token';
  await deployContract(contractArtifactName);
}
