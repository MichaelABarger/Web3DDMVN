precision highp float;

varying float v_z;

void main () {
    const vec3 color = vec3(1.0, 1.0, 0.0);
    float alpha = v_z > 0.0 ? 1.0 : 0.35;
    gl_FragColor = vec4(color, alpha);
}

