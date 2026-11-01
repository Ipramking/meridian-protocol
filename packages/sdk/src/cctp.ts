export const CCTP_DOMAINS: Record<string, number> = {
  ethereum: 0,
  avalanche: 1,
  optimism: 2,
  arbitrum: 3,
  solana: 5,
  base: 6,
  polygon: 7,
  stellar: 27,
};

export const CCTP_TOKEN_MESSENGERS: Record<string, string> = {
  ethereum: '0xBd3fa81B58Ba92a82136038B25aDec7066af3155',
  arbitrum: '0x19330d52D9F3F66d008b7a062713758b76739669',
  base: '0x1682Ae6375C4E4A97e4B583BC394c861A46D8962',
  solana: 'CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe',
  stellarTestnet: 'CDNG7HXAPBWICI2E3AUBP3YZWZELJLYSB6F5CC7WLDTLTHVM74SLRTHP',
  stellarMainnet: 'CAE2G5Z77UP7GYPYGFOWFGW7C7J6I4YP2AFGSADRKQY62SYUFLPNFTXL',
};

export const STELLAR_CCTP_CONFIG = {
  domain: 27,
  tokenMessengerTestnet: CCTP_TOKEN_MESSENGERS.stellarTestnet,
  tokenMessengerMainnet: CCTP_TOKEN_MESSENGERS.stellarMainnet,
  usdcSacMainnet: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
  usdcSacTestnet: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  meridianRouterTestnet: 'CATRAXQGN7H73LDWWLUW3IBDNZG2XYQEUIVROC2UDOQ6XRPYEKK2WUED',
};

export const CIRCLE_IRIS_API_MAINNET = 'https://iris-api.circle.com';
export const CIRCLE_IRIS_API_SANDBOX = 'https://iris-api-sandbox.circle.com';

export interface IrisForwardFeeQuote {
  finalityThreshold: number;
  minimumFee: number;
  forwardFee: {
    low: number;
    med: number;
    high: number;
  };
}

export interface IrisMessage {
  message: string;
  attestation: string | null;
  eventNonce: string;
  status: 'pending_confirmations' | 'complete';
}

/**
 * Fetch real-time CCTP V2 forwarding fee quotes from Circle Iris
 */
export async function fetchIrisForwardFees(
  sourceDomain: number,
  destDomain: number,
  isSandbox = true
): Promise<IrisForwardFeeQuote[]> {
  const baseUrl = isSandbox ? CIRCLE_IRIS_API_SANDBOX : CIRCLE_IRIS_API_MAINNET;
  const url = `${baseUrl}/v2/burn/USDC/fees/${sourceDomain}/${destDomain}?forward=true`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Iris fee quote failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as IrisForwardFeeQuote[];
}

/**
 * Queries Circle Iris V2 message indexer for a given transaction hash
 */
export async function fetchCircleV2Messages(
  sourceDomain: number,
  transactionHash: string,
  isSandbox = true
): Promise<IrisMessage[]> {
  const baseUrl = isSandbox ? CIRCLE_IRIS_API_SANDBOX : CIRCLE_IRIS_API_MAINNET;
  const url = `${baseUrl}/v2/messages/${sourceDomain}?transactionHash=${transactionHash}`;
  const res = await fetch(url);
  if (res.status === 404) {
    // 404 means transaction is not yet indexed by Circle
    return [];
  }
  if (!res.ok) {
    throw new Error(`Iris message lookup error (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as { messages?: IrisMessage[] };
  return body.messages ?? [];
}

/**
 * Polls Circle Iris V2 API until an attestation is complete and returns the signature
 */
export async function pollCircleAttestation(
  sourceDomain: number,
  transactionHash: string,
  timeoutMs = 120_000,
  isSandbox = true
): Promise<string> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      const messages = await fetchCircleV2Messages(sourceDomain, transactionHash, isSandbox);
      if (messages.length > 0 && messages[0].status === 'complete' && messages[0].attestation) {
        return messages[0].attestation;
      }
    } catch {
      // Continue polling
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`CCTP Iris attestation timed out for tx: ${transactionHash}`);
}

/**
 * Backward compatible attestation fetcher
 */
export async function fetchCircleAttestation(messageHash: string, timeoutMs = 120_000): Promise<string> {
  return pollCircleAttestation(STELLAR_CCTP_CONFIG.domain, messageHash, timeoutMs, true);
}

const DESTINATION_DOMAIN_OFFSET = 8;
const NONCE_OFFSET = 12;
const EXPIRATION_BLOCK_OFFSET = 344;

function readWord(messageHex: string, offsetBytes: number): string {
  const clean = messageHex.startsWith('0x') ? messageHex.slice(2) : messageHex;
  const startChar = offsetBytes * 2;
  const endChar = (offsetBytes + 32) * 2;
  if (clean.length < endChar) {
    throw new Error(`Malformed CCTP message: length ${clean.length} is less than required offset ${endChar}`);
  }
  return clean.slice(startChar, endChar);
}

export function readDestinationDomain(messageHex: string): number {
  const clean = messageHex.startsWith('0x') ? messageHex.slice(2) : messageHex;
  const startChar = DESTINATION_DOMAIN_OFFSET * 2;
  return parseInt(clean.slice(startChar, startChar + 8), 16);
}

export function readNonce(messageHex: string): string {
  return '0x' + readWord(messageHex, NONCE_OFFSET);
}

export function readExpirationBlock(messageHex: string): bigint {
  return BigInt('0x' + readWord(messageHex, EXPIRATION_BLOCK_OFFSET));
}
