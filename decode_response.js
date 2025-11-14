// Decode the tail end of the response to see what format it is
const tailBytes = [85,85,85,85,85,85,13,10,45,45,45,45,45,45,98,111,117,110,100,97,114,121,102,53,55,97,51,102,51,53,97,100,51,52,52,53,101,97,56,51,51,53,57,48,102,97,49,101,97,97,102,99,57,97,45,45,13,10];

const decoded = Buffer.from(tailBytes).toString('utf-8');
console.log("Tail decoded as UTF-8:");
console.log(decoded);
console.log("\nHex representation:");
console.log(Buffer.from(tailBytes).toString('hex'));

// Check if this looks like multipart boundary
if (decoded.includes('boundary')) {
  console.log("\n✓ This is a multipart/form-data response with boundary markers!");
}

// Try decoding the entire response format
const fullDump = "32,67,101,82,106,235,58,53,90,21,64,165,184,114,147,81,8,20,88,244,70,249,121,249,210,132,230,109,1,215,90,98,191,121,249,180,20,44,145,159,205,21,110,173,47,51,60,215,173,101,131,137,237,63,131,192,96,208,137,67,239,238,214,155,86,151,67,233,206,69,216,47,31,47,99,28,237,247,253,186,189,78,227,213,16,31,42,16,112,43,115,20,0,51,178,98,176,8,6,148,182,4,97,38,156,185,113,185,188,197,191,135,17,37,214,137,177,24,22,123,229,73,63,2,87,131,113,100,34,118,8,87,93,171,237,33,23,255,122,173,117,116,204,254,110,255,168,36,153,185,238,101,62,122,90,88,114,164,130,9,47,209,165,166,86,227,238,91,222,22,83,42,164,154,103,199,253,51,233,211,142,93,188,25,65,249,181,108,101,53,24,34,104,11,109,4,150,77,255,251,146,68,248";

const firstBytes = fullDump.split(',').slice(0, 20).map(Number);
console.log("\nFirst 20 bytes:");
console.log(Buffer.from(firstBytes).toString('hex'));

// Check for MP3 sync header
const mp3SyncHeader = 0xFF;
if (firstBytes[0] === 0xFF || firstBytes[1] === 0xFF) {
  console.log("✓ Looks like MP3 audio data (starts with 0xFF sync byte)");
}
