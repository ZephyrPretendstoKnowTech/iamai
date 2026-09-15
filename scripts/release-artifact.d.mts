export type ArtifactProof = { sha: string; files: Record<string, string> }
export function artifactProof(root: string, sha: string): ArtifactProof
export function verifyArtifact(root: string, proof: ArtifactProof, sha: string): boolean
