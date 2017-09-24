var gl;
var ready;
var path, path_json, xformed_path;
var mouseEvent = {active: 'none'};
var attitude = {x: 0.0, y: 0.0};
var xform = m_identity();

const SHRINK_FACTOR = 0.8;
var videoAspect = 1.0, canvasAspect = 1.0;

const ATTITUDE_MAX = 90.0;


// This IP address is simply in place to allow development on a personal webserver *without* a static IP address
const IP = '[2601:1c2:4b00:bf:641e:cf87:39b4:a4be]';
const VIDEO = 'painting1'; //'gym1';
const FETCH_MODE = {method: 'get', mode: 'no-cors', redirect: 'follow', headers: new Headers({'Content-Type': 'text/plain'})};



function generatePath (time) {
    for (var i = 0; i < path.length; i++) {
        var pt = [path[i][0], path[i][1], path[i][2]];
        var z = pt[2] - time;
        pt[2] = z;
        var xformed_vec = m_apply(xform, pt);
        xformed_path[i] = [xformed_vec[0], xformed_vec[1], z, path[i][2]];
        // 3rd element can be thought of as "offset from current time (=0)"
        // 4th element is more like a unique identifier
    }
    gl.useProgram(gl.programs.path.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.programs.path.buffers.position);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(_.flatten(xformed_path)), gl.DYNAMIC_DRAW);
}

function regenerateXforms () {
    if (!ready)
        return;

    var yrot = m_rotate_y(attitude.y / 2.0);
    var xrot = m_rotate_x(attitude.x / 2.0);
    var rot = m_x(yrot, xrot);

    var scale = m_scale(SHRINK_FACTOR, SHRINK_FACTOR * videoAspect, 1.0);
    var proj = m_scale(1.0, canvasAspect, 1.0);
    xform = m_x(proj, m_x(rot, scale));
    var xformgl = m_gl(xform);

    gl.useProgram(gl.programs.video.program);
    gl.uniformMatrix3fv(gl.programs.video.uniforms.xform, false, xformgl);
    gl.useProgram(gl.programs.path.program);
    gl.uniformMatrix3fv(gl.programs.path.uniforms.xform, false, xformgl);
    gl.useProgram(gl.programs.box.program);
    gl.uniformMatrix3fv(gl.programs.box.uniforms.xform, false, xformgl);
}


function initGL (video) {
    gl.clearColor(0.1, 0.1, 0.25, 1.0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // SHADERS
    gl.programs = {};
    gl.programs.video = {};
    gl.programs.path = {};
    var vid_loaded = new Promise((resolve, reject) => video.addEventListener('loadeddata', () => resolve()));
    
    var compileShader = (src, type) => {
        var s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
            console.log(gl.getShaderInfoLog(s));
        return s;
    };
    var downloadShaders = (name) => {
        var downloadShader = (type) => {
            var extension = type == gl.VERTEX_SHADER ? 'vs' : 'fs';
            var t = type == gl.VERTEX_SHADER ? 'vertex' : 'fragment';
            var uri = `http://${IP}/dmvn/shader/${name}.${extension}`;
            return fetch(uri, FETCH_MODE)
                .then((response) => response.text(), () => alert(`Could not download ${uri} (${name} ${t} shader)!`))
                .then((src) => compileShader(src, type));
        };
        return [downloadShader(gl.VERTEX_SHADER), downloadShader(gl.FRAGMENT_SHADER)];
    };
    var video_src = downloadShaders('dmvn');
    var path_src = downloadShaders('path');
    var path_req = fetch(`http://${IP}/dmvn/res/${VIDEO}.json`, FETCH_MODE)
        .then((response) => response.json(), () => alert("Could not download Path JSON!"))
        .then((json) => path_json = json);
    var box_src = downloadShaders('box');

    Promise.all(_.flatten([video_src, path_src, vid_loaded, path_req, box_src])).then((shader) => {
        var linkProgram = (name, s1, s2) => {
            gl.programs[name] = {};
            gl.programs[name].program = gl.createProgram();
            gl.attachShader(gl.programs[name].program, s1);
            gl.attachShader(gl.programs[name].program, s2);
            gl.linkProgram(gl.programs[name].program);
            if (!gl.getProgramParameter(gl.programs[name].program, gl.LINK_STATUS))
                alert(`Could not link ${name} shaders!`);
        };
        linkProgram('video', shader[0], shader[1]);
        linkProgram('path', shader[2], shader[3]);
        linkProgram('box', shader[6], shader[7]);

        // BUFFERS
        gl.useProgram(gl.programs.video.program);
        gl.programs.video.buffers = {};
        gl.programs.video.buffers.position = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.programs.video.buffers.position);
        // correct for video aspect ratio
        const VIDEO_POSITION = [
            -1.0,  1.0, 0.0,
             1.0,  1.0, 0.0,
            -1.0, -1.0, 0.0,
            -1.0, -1.0, 0.0,
             1.0,  1.0, 0.0,
             1.0, -1.0, 0.0
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(VIDEO_POSITION), gl.STATIC_DRAW);
        gl.programs.video.buffers.position.size = 3;
        gl.programs.video.buffers.position.ct = 6;
        gl.programs.video.buffers.position.attribute = gl.getAttribLocation(gl.programs.video.program, "a_position");
        gl.enableVertexAttribArray(gl.programs.video.buffers.position.attribute);

        gl.programs.video.buffers.texcoord = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.programs.video.buffers.texcoord);
        const VIDEO_TEXCOORD = [
            0.0, 0.0,
            1.0, 0.0,
            0.0, 1.0,
            0.0, 1.0,
            1.0, 0.0,
            1.0, 1.0
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(VIDEO_TEXCOORD), gl.STATIC_DRAW);
        gl.programs.video.buffers.texcoord.size = 2;
        gl.programs.video.buffers.texcoord.ct = 6;
        gl.programs.video.buffers.texcoord.attribute = gl.getAttribLocation(gl.programs.video.program, "a_texcoord");
        gl.enableVertexAttribArray(gl.programs.video.buffers.texcoord.attribute);

        //    path buffers
        path = path_json.path;
        xformed_path = new Array(path.length);

        gl.useProgram(gl.programs.path.program);
        gl.programs.path.buffers = {};
        gl.programs.path.buffers.position = gl.createBuffer();
        gl.programs.path.buffers.position.size = 4;
        gl.programs.path.buffers.position.ct = path.length;
        gl.programs.path.buffers.position.attribute = gl.getAttribLocation(gl.programs.path.program, "a_position");
        gl.enableVertexAttribArray(gl.programs.path.buffers.position.attribute);

        //    box buffers
        const BOX_POSITION = [
            // top rear left corner
            -1.0,  1.0,  0.0,
             1.0,  1.0,  0.0,
            -1.0,  1.0,  0.0,
            -1.0,  1.0,  1.0,
            -1.0,  1.0,  0.0,
            -1.0, -1.0,  0.0,
            // top rear right corner
             1.0,  1.0,  0.0,
             1.0, -1.0,  0.0,
             1.0,  1.0,  0.0,
             1.0,  1.0,  1.0,
            // top front right corner
             1.0,  1.0,  1.0,
            -1.0,  1.0,  1.0,
             1.0,  1.0,  1.0,
             1.0, -1.0,  1.0,
            // top front left corner
            -1.0,  1.0,  1.0,
            -1.0, -1.0,  1.0,
            // bottom rear left corner
            -1.0, -1.0,  0.0,
             1.0, -1.0,  0.0,
            -1.0, -1.0,  0.0,
            -1.0, -1.0,  1.0,
            // bottom front right corner
             1.0, -1.0,  1.0,
            -1.0, -1.0,  1.0,
             1.0, -1.0,  1.0,
             1.0, -1.0,  0.0
        ];
        gl.useProgram(gl.programs.box.program);
        gl.programs.box.buffers = {};
        gl.programs.box.buffers.position = gl.createBuffer();
        gl.programs.box.buffers.position.size = 3;
        gl.programs.box.buffers.position.ct = BOX_POSITION.length / 3;
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.programs.box.buffers.position);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(BOX_POSITION), gl.STATIC_DRAW);
        gl.programs.box.buffers.position.attribute = gl.getAttribLocation(gl.programs.box.program, 'a_position');
        gl.enableVertexAttribArray(gl.programs.box.buffers.position.attribute);



        // UNIFORMS
        videoAspect = parseFloat(video.videoHeight) / parseFloat(video.videoWidth);

        gl.useProgram(gl.programs.video.program);
        gl.programs.video.uniforms = {};
        gl.programs.video.uniforms.sampler = gl.getUniformLocation(gl.programs.video.program, 'u_sampler');
        gl.programs.video.uniforms.xform = gl.getUniformLocation(gl.programs.video.program, 'u_xform');
        gl.uniform1f(gl.programs.video.uniforms.aspectRatio, 1.0);

        gl.useProgram(gl.programs.path.program);
        gl.programs.path.uniforms = {};
        gl.programs.path.uniforms.xform = gl.getUniformLocation(gl.programs.path.program, 'u_xform');

        gl.useProgram(gl.programs.box.program);
        gl.programs.box.uniforms = {};
        gl.programs.box.uniforms.xform = gl.getUniformLocation(gl.programs.box.program, 'u_xform');
        gl.programs.box.uniforms.time = gl.getUniformLocation(gl.programs.box.program, 'u_time');


        // TEXTURES
        gl.useProgram(gl.programs.video.program);
        gl.programs.video.texture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, gl.programs.video.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.uniform1i(gl.programs.video.uniforms.sampler, 0);

        ready = true;
        dirty = true;
    }, (reason) => {
        alert(`Could not download requisite files! (${reason})`);
    });

}




document.addEventListener('DOMContentLoaded', () => {
    var canvas, video;
    var resizeDirty = true;

    // element and context setup
    video = document.querySelector('#video');
    video.src = `res/${VIDEO}.mp4`;

    canvas = document.querySelector('#canvas');
    gl = canvas.getContext('webgl');
    initGL(video);

    canvas.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        active = (ev.which === 3 || ev.button === 2) ? 'right' : 'left';
        if (ev.which === 3 || ev.button === 2)
            active = 'right';
        else if (ev.which === 2 || ev.button === 1) {
            active = 'middle';
            video.currentTime = 0.0;
            video.pause();
        } else
            active = 'left';
        mouseEvent = {
            active: active,
            prev: {x: ev.clientX, y: ev.clientY},
            cur: {x: ev.clientX, y: ev.clientY},
            first: true
        };
        return false;
    }, false);
    window.addEventListener('mouseup', (ev) => {
        MIDDLE_COND:
        if (mouseEvent.active === 'middle') {
            var to_s = (n) => ("000" + n).slice(-4);
            var project = (x, y) => {
                var a = m_apply(xform, [-1.0,  1.0,  0.0]);
                var b = m_apply(xform, [ 1.0,  1.0,  0.0]);
                var c = m_apply(xform, [-1.0, -1.0,  0.0]);
                var u = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
                var v = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
                var A = m_3x3(u[0], u[1], u[2], v[0], v[1], v[2], 0.0, 0.0, 1.0);
                var B = [x - a[0], y - a[1], -a[2]];
                var Ainv = m_invert(A);
                var X = m_apply(Ainv, B);
                var s = X[0];
                var t = X[1];
                var r = X[2];
                retval = [s, t];
                return retval;
            };
            var uv = project(2.0 * ev.clientX / canvas.clientWidth - 1.0, -2.0 * ev.clientY / canvas.clientHeight + 1.0);
            var oob = uv[0] < 0.0 || uv[1] < 0.0 || uv[0] > 1.0 || uv[1] > 1.0;
            if (oob)
                break MIDDLE_COND;
            var pix = [parseInt(Math.round(uv[0] * video.videoWidth)), parseInt(Math.round(uv[1] * video.videoHeight))];
            var xs = to_s(pix[0]);
            var ys = to_s(pix[1]);
            fetch(`http://${IP}/dmvn/res/${VIDEO}/${VIDEO}-${xs}x${ys}.json`, FETCH_MODE)
                .then((response) => response.json(), () => alert("Could not download new Path JSON!"))
                .then((json) => {
                    path_json = json;
                    path = json.path;
                });
        }
        mouseEvent.active = 'none';
        var time = video.currentTime / video.duration;
        if (time < 1.0)
            video.play();
    });
    window.addEventListener('mousemove', (ev) => {
        mouseEvent.cur = {x: ev.clientX, y: ev.clientY};
    });
    canvas.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        return false;
    }, false);

    var animationLoop = () => {
        const time = video.currentTime / video.duration;
        if (resizeDirty) {
            const x = canvas.clientWidth;
            const y = canvas.clientHeight;
            canvas.width = x;
            canvas.height = y;
            gl.viewport(0, 0, x, y);
            canvasAspect = parseFloat(x) / parseFloat(y);
            regenerateXforms();
            dirty = false;
        }
        if (mouseEvent.active === 'right') {
            var delta = {x: mouseEvent.cur.x - mouseEvent.prev.x, y: mouseEvent.cur.y - mouseEvent.prev.y};
            attitude.x = Math.min(Math.max(attitude.x + delta.x, -ATTITUDE_MAX), ATTITUDE_MAX);
            attitude.y = Math.min(Math.max(attitude.y + delta.y, -ATTITUDE_MAX), ATTITUDE_MAX);
            mouseEvent.prev = {x: mouseEvent.cur.x, y: mouseEvent.cur.y};

            regenerateXforms();
        }
        if (mouseEvent.active === 'left') {
            var detectClosestPoint = (x, y, time, first) => {
                x = 2.0 * x / canvas.clientWidth - 1.0;
                y = -2.0 * y / canvas.clientHeight + 1.0;
                var closest;
                var shortest_dist_sq = 100.0;
                for (var i = 0; i < xformed_path.length; i++) {
                    var dx = x - xformed_path[i][0];
                    var dy = y - xformed_path[i][1];
                    const K = 0.9;
                    var dt = K * xformed_path[i][2];
                    var dist_sq = first ? dx * dx + dy * dy : dx * dx + dy * dy + dt * dt;
                    if (dist_sq < shortest_dist_sq) {
                        shortest_dist_sq = dist_sq;
                        closest = xformed_path[i][3];
                    }
                }
                return closest;
            };

            var closest = detectClosestPoint(mouseEvent.cur.x, mouseEvent.cur.y, time, mouseEvent.first);
            mouseEvent.first = false;
            var targetTime = closest * video.duration;
            video.currentTime = targetTime;
        }
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        if (ready) {
            gl.useProgram(gl.programs.video.program);
            gl.bindBuffer(gl.ARRAY_BUFFER, gl.programs.video.buffers.position);
            gl.vertexAttribPointer(gl.programs.video.buffers.position.attribute, gl.programs.video.buffers.position.size, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, gl.programs.video.buffers.texcoord);
            gl.vertexAttribPointer(gl.programs.video.buffers.texcoord.attribute, gl.programs.video.buffers.texcoord.size, gl.FLOAT, false, 0, 0);
            gl.bindTexture(gl.TEXTURE_2D, gl.programs.video.texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
            gl.drawArrays(gl.TRIANGLES, 0, gl.programs.video.buffers.position.ct);

            gl.useProgram(gl.programs.path.program);
            generatePath(time);
            gl.bindBuffer(gl.ARRAY_BUFFER, gl.programs.path.buffers.position);
            gl.vertexAttribPointer(gl.programs.path.buffers.position.attribute, gl.programs.path.buffers.position.size, gl.FLOAT, false, 0, 0);
            gl.drawArrays(gl.LINE_STRIP, 0, gl.programs.path.buffers.position.ct);

            gl.useProgram(gl.programs.box.program);
            gl.uniform1f(gl.programs.box.uniforms.time, time);
            gl.bindBuffer(gl.ARRAY_BUFFER, gl.programs.box.buffers.position);
            gl.vertexAttribPointer(gl.programs.box.buffers.position.attribute, gl.programs.box.buffers.position.size, gl.FLOAT, false, 0, 0);
            gl.drawArrays(gl.LINES, 0, gl.programs.box.buffers.position.ct);
        }
        window.requestAnimationFrame(animationLoop);
    };
    // event listeners
    canvas.addEventListener('resize', () => resizeDirty = true);
    // start animation loop
    window.requestAnimationFrame(animationLoop);
});

