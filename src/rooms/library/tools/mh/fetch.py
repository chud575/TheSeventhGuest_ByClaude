"""Download (and cache) the CC0 MakeHuman assets the ghost head is built from.

MakeHuman's base mesh, targets and proxies were released as CC0 1.0 (see
https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md). We only
use the synthetic base mesh plus modelling targets as an anatomical starting
point; the character itself (proportions, ageing, wrinkles, colouring, hair,
eyes, costume) is authored here, so he is an original person, not a scan.
"""
import os
import urllib.request

BASE = 'https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data/'
CACHE = os.environ.get('MH_CACHE') or os.path.join(os.path.dirname(os.path.abspath(__file__)), '.cache')


def fetch(rel):
    path = os.path.join(CACHE, rel)
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with urllib.request.urlopen(BASE + rel) as r:
            data = r.read()
        with open(path, 'wb') as f:
            f.write(data)
    return path


def load_obj(path):
    V, VT, F, FT, G = [], [], [], [], []
    g = None
    for line in open(path):
        if line.startswith('v '):
            V.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('vt '):
            VT.append([float(x) for x in line.split()[1:3]])
        elif line.startswith('g '):
            g = line.split()[1]
        elif line.startswith('f '):
            p = [t.split('/') for t in line.split()[1:]]
            F.append([int(a[0]) - 1 for a in p])
            FT.append([int(a[1]) - 1 if len(a) > 1 and a[1] else -1 for a in p])
            G.append(g)
    return V, VT, F, FT, G


def load_target(rel):
    import numpy as np
    idx, d = [], []
    for line in open(fetch('targets/' + rel + '.target')):
        if not line.strip() or line.startswith('#'):
            continue
        p = line.split()
        idx.append(int(p[0]))
        d.append([float(p[1]), float(p[2]), float(p[3])])
    return np.array(idx, dtype=np.int64), np.array(d, dtype=np.float64).reshape(-1, 3)
