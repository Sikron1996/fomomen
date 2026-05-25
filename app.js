import { ethers } from "https://esm.sh/ethers@6.13.4";

const CONTRACT_ADDRESS = "PASTE_CONTRACT_ADDRESS_HERE";
const READ_RPC = "https://ethereum.publicnode.com";
const MAX_SUPPLY = 10000;
const PRICE_ETH = "0.0001";

const ABI = [
  "function mint(uint256 amount) external payable",
  "function PRICE() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function minted(address user) view returns (uint256)"
];

let provider, signer, contract, readProvider, readContract, account;
const $ = id => document.getElementById(id);

function amount(){
  let a = Number($("amount").value);
  if(!a || a < 1) a = 1;
  if(a > 100) a = 100;
  $("amount").value = a;
  return a;
}

function initRead(){
  if(CONTRACT_ADDRESS === "PASTE_CONTRACT_ADDRESS_HERE"){
    $("status").textContent = "Встав адресу контракту в app.js";
    return false;
  }

  readProvider = new ethers.JsonRpcProvider(READ_RPC);
  readContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, readProvider);

  $("etherscanLink").href = "https://etherscan.io/address/" + CONTRACT_ADDRESS;
  $("openseaLink").href = "https://opensea.io/assets/ethereum/" + CONTRACT_ADDRESS;
  return true;
}

async function loadSupply(){
  try{
    if(!readContract && !initRead()) return;
    const s = Number(await readContract.totalSupply());
    const pct = s / MAX_SUPPLY * 100;

    $("mintedText").textContent = s.toLocaleString();
    $("remainingText").textContent = (MAX_SUPPLY - s).toLocaleString();
    $("progressBar").style.width = pct + "%";
    $("percentText").textContent = pct.toFixed(2) + "%";

    await updatePrice();
  }catch(e){
    $("status").textContent = "Read error: " + (e.shortMessage || e.message);
  }
}

async function connect(){
  try{
    if(!window.ethereum) throw new Error("Wallet not found");

    if(await window.ethereum.request({method:"eth_chainId"}) !== "0x1"){
      await window.ethereum.request({
        method:"wallet_switchEthereumChain",
        params:[{chainId:"0x1"}]
      });
    }

    const acc = await window.ethereum.request({method:"eth_requestAccounts"});
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    account = acc[0];

    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    readContract = contract;

    $("wallet").textContent = account.slice(0,6) + "..." + account.slice(-4);
    await loadSupply();
    await updatePrice();
  }catch(e){
    $("status").textContent = "Error: " + (e.shortMessage || e.message);
  }
}

async function updatePrice(){
  const a = BigInt(amount());

  if(!contract || !account){
    $("totalPrice").textContent = a === 1n ? "FREE" : (Number(a - 1n) * Number(PRICE_ETH)).toFixed(4) + " ETH";
    return;
  }

  const p = await contract.PRICE();
  const used = await contract.minted(account);

  let paid = a;
  if(used === 0n) paid = paid > 0n ? paid - 1n : 0n;

  $("totalPrice").textContent = paid === 0n ? "FREE" : ethers.formatEther(p * paid) + " ETH";
}

async function mint(){
  try{
    if(!contract){
      await connect();
      if(!contract) return;
    }

    const a = BigInt(amount());
    const p = await contract.PRICE();
    const used = await contract.minted(account);

    let paid = a;
    if(used === 0n) paid = paid > 0n ? paid - 1n : 0n;

    $("status").textContent = "Confirm mint...";
    const tx = await contract.mint(Number(a), { value: p * paid });

    $("status").textContent = "Tx: " + tx.hash;
    await tx.wait();

    $("status").textContent = "Mint success";
    await loadSupply();
  }catch(e){
    $("status").textContent = "Error: " + (e.shortMessage || e.message);
  }
}

$("connectBtn").onclick = connect;
$("mintBtn").onclick = mint;
$("refreshBtn").onclick = loadSupply;
$("minus").onclick = async()=>{ $("amount").value = Math.max(1, amount()-1); await updatePrice(); };
$("plus").onclick = async()=>{ $("amount").value = Math.min(100, amount()+1); await updatePrice(); };
$("amount").oninput = updatePrice;

let slide = 1;
setInterval(()=>{
  slide = slide % 6 + 1;
  $("mainImg").src = `assets/fomo${slide}.jpg`;
}, 1600);

initRead();
loadSupply();
updatePrice();
