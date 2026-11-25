import { type Frame, readSdf } from "@molcrafts/molvis-core/molrs";

/** Read the existing PubChem 3D conformer for a compound name or CID. */
export async function fetchPubChem3DFrame(
  query: string,
  signal?: AbortSignal,
): Promise<Frame> {
  const name = query.trim();
  if (!name) throw new Error("Enter a PubChem name or CID");

  const namespace = /^\d+$/.test(name) ? "cid" : "name";
  const response = await fetch(
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/${namespace}/${encodeURIComponent(name)}/record/SDF?record_type=3d`,
    { headers: { Accept: "chemical/x-mdl-sdfile" }, signal },
  );
  if (response.status === 404) throw new Error(`PubChem: "${name}" not found`);
  if (!response.ok) throw new Error(`PubChem error ${response.status}`);
  const sdf = await response.text();
  if (!sdf.trim()) throw new Error("PubChem returned empty SDF");
  signal?.throwIfAborted();
  return readSdf(sdf);
}
