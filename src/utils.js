import util from 'util';
import crypto from 'crypto';
const randomBytesAsync = util.promisify(crypto.randomBytes);

export default { randomBytesAsync };