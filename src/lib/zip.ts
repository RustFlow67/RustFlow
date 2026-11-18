import { deflateRawSync } from "node:zlib";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Buffer;
  /**
   * Хранить без сжатия (method 0 "store"). Обязательно для уже сжатых
   * бинарников (.woff2, .jpg, .png, .ico): байты попадают в архив 1-в-1,
   * а распаковщики не могут повредить или пропустить такой файл.
   */
  store?: boolean;
}

export interface ZipOptions {
  /**
   * Добавлять явные записи каталогов (public/, public/fonts/, ...).
   * Некоторые распаковщики и ОС создают папки только по ним — без этого
   * бинарные ассеты в подпапках могут «теряться» при извлечении.
   */
  includeDirs?: boolean;
}

/** Minimal dependency-free ZIP writer (deflate or store, UTF-8 names, dir entries). */
export function createZip(files: ZipEntry[], options: ZipOptions = {}): Buffer {
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  // Явные записи каталогов идут первыми — так папки существуют до файлов.
  const entries: ZipEntry[] = [];
  if (options.includeDirs) {
    const dirs = new Set<string>();
    for (const file of files) {
      const parts = file.name.split("/");
      for (let i = 1; i < parts.length; i++) {
        dirs.add(`${parts.slice(0, i).join("/")}/`);
      }
    }
    for (const dir of Array.from(dirs).sort()) {
      entries.push({ name: dir, data: Buffer.alloc(0), store: true });
    }
  }
  entries.push(...files);

  const body: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const file of entries) {
    const isDir = file.name.endsWith("/");
    const name = Buffer.from(file.name, "utf8");
    const useStore = Boolean(file.store) || isDir;
    const compressed = useStore ? file.data : deflateRawSync(file.data);
    const crc = isDir ? 0 : crc32(file.data);
    const method = useStore ? 0 : 8;
    // The Unix producer flag requires Unix mode bits as well as the DOS directory flag.
    // Without them, Info-ZIP extracts the explicit directories with permissions 000.
    const versionMadeBy = 0x0314;
    const unixMode = isDir ? 0o40755 : 0o100644;
    const externalAttrs = ((unixMode << 16) | (isDir ? 0x10 : 0)) >>> 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    body.push(local, name, compressed);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(versionMadeBy, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(method, 10);
    entry.writeUInt16LE(dosTime, 12);
    entry.writeUInt16LE(dosDate, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(compressed.length, 20);
    entry.writeUInt32LE(file.data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt16LE(0, 30);
    entry.writeUInt16LE(0, 32);
    entry.writeUInt16LE(0, 34);
    entry.writeUInt16LE(0, 36);
    entry.writeUInt32LE(externalAttrs, 38);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, name);

    offset += local.length + name.length + compressed.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...body, centralBuf, end]);
}
