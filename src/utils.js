import util from 'util';
import crypto from 'crypto';

export const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d!@#$%^&*.,]{8,64}$/;
export const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const randomBytesAsync = util.promisify(crypto.randomBytes);

export const error = (err, req, res, status = 400, page = "error.art") => {
    return res.status(status).render(page, {
        error: err,
        referer: req.path ?? undefined
    });
}