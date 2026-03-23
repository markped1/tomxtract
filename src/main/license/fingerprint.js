"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMachineId = generateMachineId;
const si = __importStar(require("systeminformation"));
const crypto = __importStar(require("crypto"));
let cachedId = null;
async function generateMachineId() {
    if (cachedId)
        return cachedId;
    try {
        const [cpu, disk, os] = await Promise.all([
            si.cpu(),
            si.diskLayout(),
            si.osInfo(),
        ]);
        const rawId = [
            cpu.manufacturer,
            cpu.brand,
            cpu.stepping?.toString() || '',
            disk[0]?.serialNum || '',
            os.serial || '',
            os.hostname || '',
        ].join('|');
        const hash = crypto.createHash('sha256').update(rawId).digest('hex');
        cachedId = `TX49JA-${hash.substring(0, 12).toUpperCase()}`;
        return cachedId;
    }
    catch {
        const fallback = crypto.randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase();
        cachedId = `TX49JA-${fallback}`;
        return cachedId;
    }
}
