
var _sincos = (t) => {
    t *= Math.PI / 180.0;
    return {c: Math.cos(t), s: Math.sin(t)};
};


var m_scale = (x, y, z) => [[x, 0.0, 0.0], [0.0, y, 0.0], [0.0, 0.0, z]];
var m_identity = () => m_scale(1.0, 1.0, 1.0);


var m_rotate_x = (t) => {
    var T = _sincos(t);
    return [[T.c, 0.0, -T.s],
            [0.0, 1.0, 0.0],
            [T.s, 0.0, T.c]];
};

var m_rotate_y = (t) => {
    var T = _sincos(t);
    return [[1.0, 0.0, 0.0],
            [0.0, T.c, T.s],
            [0.0, -T.s, T.c]];
};

var m_rotate_z = (t) => {
    var T = _sincos(t);
    return [[T.c, -T.s, 0.0],
            [T.s, T.c, 0.0],
            [0.0, 0.0, 1.0]];
};


var m_x = (m1, m2) => {
    var m = m_identity();
    for (var i = 0; i < 3; i++)
        for (var j = 0; j < 3; j++) {
            var acc = 0.0;
            for (var k = 0; k < 3; k++)
                acc += m1[i][k] * m2[k][j];
            m[i][j] = acc;
        }
    return m;
};

var m_apply = (m, v) => {
    var retval = new Array(3);
    for (var i = 0; i < 3; i++) {
        var acc = 0.0;
        for (var j = 0; j < 3; j++)
            acc += m[j][i] * v[j];
        retval[i] = acc;
    }
    return retval;
};

var m_apply2x2 = (m, v) => [v[0] * m[0][0] + v[1] * m[0][1], v[0] * m[1][0] + v[1] * m[1][1]];

var m_xpose = (m) => {
    var retval = new Array(3);
    for (var i = 0; i < 3; i++) {
        retval[i] = new Array(3);
        for (var j = 0; j < 3; j++)
            retval[i][j] = m[j][i];
    }
    return retval;
};

var m_2x2 = (m11, m12, m21, m22) => [[m11, m12], [m21, m22]];
var m_2x2a = (a) => [[a[0], a[1]], [a[2], a[3]]];
var m_3x3 = (m11, m12, m13, m21, m22, m23, m31, m32, m33) => [[m11, m12, m13],[m21, m22, m23],[m31, m32, m33]];

var m_det2x2 = (m) => m[0][0] * m[1][1] - m[1][0] * m[0][1];

var m_gl = (m) => new Float32Array(_.flatten(m));

var m_of_minors = (m) => {
    var retval = new Array(3);
    for (var i = 0; i < 3; i++) {
        retval[i] = new Array(3);
        for (var j = 0; j < 3; j++) {
            a = [];
            for (var k = 0; k < 3; k++) {
                if (k == i)
                    continue;
                for (var l = 0; l < 3; l++) {
                    if (l == j)
                        continue;
                    a.push(m[k][l]);
                }
            }
            var minor_m = m_2x2a(a);
            var minor = m_det2x2(minor_m);
            retval[i][j] = minor;
        }
    }
    return retval;
};

var m_det3x3 = (m, minors) => m[0][0] * minors[0][0] - m[0][1] * minors[0][1] + m[0][2] * minors[0][2];

var m_scalar_x = (s, m) => {
    return [[s * m[0][0], s * m[0][1], s * m[0][2]],
            [s * m[1][0], s * m[1][1], s * m[1][2]],
            [s * m[2][0], s * m[2][1], s * m[2][2]]];
};

var m_scalar2x2_x = (s, m) => {
    return [[s * m[0][0], s * m[0][1]],
            [s * m[1][0], s * m[1][1]]];
};


var m_of_cofactors = (m) => {
    return [[m[0][0],-m[0][1],m[0][2]],
            [-m[1][0],m[1][1],-m[1][2]],
            [m[2][0],-m[2][1],m[2][2]]];
};


var m_invert = (m) => {
    var minors = m_of_minors(m);
    var adjugate = m_xpose(m_of_cofactors(minors));
    var d = m_det3x3(m, minors);
    return m_scalar_x(1.0 / d, adjugate);
};

var m_inv2x2 = (m) => m_scalar2x2_x(1.0 / m_det2x2(m), m_2x2(m[1][1], -m[0][1], -m[1][0], m[0][0]));
var m_xpose2x2 = (m) => [[m[1][1], m[1][0]], [m[0][1], m[0][0]]];

