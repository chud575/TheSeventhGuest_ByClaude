"""Small numpy mesh toolkit: Catmull-Clark on quad meshes (with open boundaries),
vertex normals, one-ring adjacency and Laplacian smoothing."""
import numpy as np
import scipy.sparse as sp


def edges_of(Q):
    """Q: (F,4) quads -> unique edges (E,2), face-edge index (F,4)."""
    e = np.stack([Q, np.roll(Q, -1, axis=1)], axis=2).reshape(-1, 2)
    es = np.sort(e, axis=1)
    uniq, inv = np.unique(es, axis=0, return_inverse=True)
    return uniq, inv.reshape(-1, 4)


def catmull_clark(V, Q):
    nv, nf = len(V), len(Q)
    E, FE = edges_of(Q)
    ne = len(E)
    fp = V[Q].mean(axis=1)
    # faces per edge
    ef_count = np.bincount(FE.ravel(), minlength=ne)
    ef_sum = np.zeros((ne, 3))
    np.add.at(ef_sum, FE.ravel(), np.repeat(fp, 4, axis=0))
    boundary_e = ef_count == 1
    mid = (V[E[:, 0]] + V[E[:, 1]]) / 2
    ep = mid.copy()
    # interior edge point = (v0 + v1 + f0 + f1) / 4
    inter = ~boundary_e
    ep[inter] = (V[E[inter, 0]] + V[E[inter, 1]] + ef_sum[inter]) / 4
    # vertex points
    val = np.bincount(E.ravel(), minlength=nv).astype(float)
    fsum = np.zeros((nv, 3)); fcnt = np.zeros(nv)
    np.add.at(fsum, Q.ravel(), np.repeat(fp, 4, axis=0)); np.add.at(fcnt, Q.ravel(), 1)
    rsum = np.zeros((nv, 3))
    np.add.at(rsum, E[:, 0], mid); np.add.at(rsum, E[:, 1], mid)
    n = val
    Fa = fsum / np.maximum(fcnt, 1)[:, None]
    Ra = rsum / np.maximum(n, 1)[:, None]
    vp = (Fa + 2 * Ra + (n - 3)[:, None] * V) / np.maximum(n, 1)[:, None]
    # boundary vertices: 3/4 P + 1/8 (two boundary neighbours)
    be = E[boundary_e]
    bnb = np.zeros((nv, 3)); bcnt = np.zeros(nv)
    np.add.at(bnb, be[:, 0], V[be[:, 1]]); np.add.at(bnb, be[:, 1], V[be[:, 0]])
    np.add.at(bcnt, be[:, 0], 1); np.add.at(bcnt, be[:, 1], 1)
    isb = bcnt >= 2
    vp[isb] = 0.75 * V[isb] + 0.125 * bnb[isb] * (2 / bcnt[isb])[:, None]
    lone = fcnt == 0
    vp[lone] = V[lone]
    NV = np.concatenate([vp, ep, fp])
    eo, fo = nv, nv + ne
    a, b, c, d = Q.T
    eab, ebc, ecd, eda = (FE[:, i] + eo for i in range(4))
    f = np.arange(nf) + fo
    NQ = np.concatenate([
        np.stack([a, eab, f, eda], 1), np.stack([b, ebc, f, eab], 1),
        np.stack([c, ecd, f, ebc], 1), np.stack([d, eda, f, ecd], 1)])
    # attribute interpolation helper: returns (vertex weights) as sparse matrix NVxV for linear attrs
    return NV, NQ, (E, FE)


def subdivide_attr(A, Q, E, FE, boundary_aware=True):
    """Linear (not smoothed) interpolation of per-vertex attributes through one CC step."""
    fp = A[Q].mean(axis=1)
    ep = (A[E[:, 0]] + A[E[:, 1]]) / 2
    return np.concatenate([A, ep, fp])


def tris(Q):
    return np.concatenate([Q[:, [0, 1, 2]], Q[:, [0, 2, 3]]])


def vertex_normals(V, T):
    n = np.cross(V[T[:, 1]] - V[T[:, 0]], V[T[:, 2]] - V[T[:, 0]])
    vn = np.zeros_like(V)
    for k in range(3):
        np.add.at(vn, T[:, k], n)
    return vn / np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-12)


def adjacency(nv, T):
    i = np.concatenate([T[:, 0], T[:, 1], T[:, 2], T[:, 1], T[:, 2], T[:, 0]])
    j = np.concatenate([T[:, 1], T[:, 2], T[:, 0], T[:, 0], T[:, 1], T[:, 2]])
    A = sp.coo_matrix((np.ones(len(i)), (i, j)), shape=(nv, nv)).tocsr()
    A.data[:] = 1
    return A


def smooth(X, A, iters=1, lam=0.5):
    deg = np.asarray(A.sum(axis=1)).ravel()
    deg[deg == 0] = 1
    for _ in range(iters):
        X = X + lam * ((A @ X) / deg[:, None] - X)
    return X
