import fs from 'fs';

export default function exists(pathName) {
    try {
        fs.statSync(pathName);
        return true;
    } catch (e) {
        return false;
    }
};