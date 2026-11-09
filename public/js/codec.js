// Ofuscación simple de la respuesta para que no se lea a simple vista en los datos.
// NO es seguridad: sin backend, alguien con conocimientos técnicos puede decodificarla.
// Funciona igual en el navegador y en Node (lo usa scripts/build-data.mjs).

const KEY = new TextEncoder().encode("onepixel-no-spoilers");

function xor(bytes) {
  return bytes.map((b, i) => b ^ KEY[i % KEY.length]);
}

export function encode(obj) {
  const bytes = xor(new TextEncoder().encode(JSON.stringify(obj)));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

export function decode(str) {
  const bin = atob(str);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(xor(bytes)));
}
