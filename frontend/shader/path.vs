precision highp float;

attribute vec4 a_position;

varying float v_z;

void main () {
    v_z = a_position.z;
    gl_Position = vec4(a_position.xy, 0.2, 1.0);
}

