/**
 * Wallet generator — menggunakan ethers.js
 * Sama persis dengan yang ada di bot_ui_ext.js tapi diekstrak jadi modul
 */
import { Wallet } from 'ethers';

export function generateWallet() {
  const wallet = Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    signMessage: (message) => wallet.signMessage(message),
  };
}

export function walletFromPrivateKey(privateKey) {
  const wallet = new Wallet(privateKey);
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    signMessage: (message) => wallet.signMessage(message),
  };
}
