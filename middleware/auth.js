export function requireAuth(req, res, next){
    if(!req.user) return res.status(401).json({error: "No autenticado"});
    return next();
}

export function requireAdmin(req, res, next){
    if(!req.user) return res.status(401).json({error: "No autenticado"});
    if(!req.user.isAdmin) return res.status(403).json({error: "Se requiere privilegios de admin"});
    return next();
}
