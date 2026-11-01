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

export const STELLAR_CCTP_CONFIG = {
  domain: 27,
  usdcSacMainnet: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
  usdcSacTestnet: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  meridianRouterTestnet: 'CATRAXQGN7H73LDWWLUW3IBDNZG2XYQEUIVROC2UDOQ6XRPYEKK2WUED',
};

export const CIRCLE_IRIS_API = 'https://iris-api.circle.com';

/**
 * Polls Circle Attestation API until the message attestation is complete
 */
export async function fetchCircleAttestation(messageHash: string, timeoutMs = 120_000): Promise<string> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      const res = await fetch(`${CIRCLE_IRIS_API}/v1/attestations/${messageHash}`);
      if (res.ok) {
        const data = (await res.json()) as { status: string; attestation?: string };
        if (data.status === 'complete' && data.attestation) {
          return data.attestation;
        }
      }
    } catch {
      // Continue polling
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`CCTP attestation timed out for hash: ${messageHash}`);
}
