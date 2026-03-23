/** Opciones alineadas entre setCookie y clearCookie (prod: Secure, etc.) */
function jwtCookieOptions(maxAgeMs = 8 * 60 * 60 * 1000) {
    return {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge:   maxAgeMs,
        path:     '/',
    };
}

function clearJwtCookie(res, name) {
    res.clearCookie(name, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path:     '/',
    });
}

module.exports = { jwtCookieOptions, clearJwtCookie };
