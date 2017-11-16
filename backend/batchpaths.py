import cv2 as cv
import numpy as np
import sys
import json, codecs

shape = (360,640,2)
fshape = (float(shape[0]), float(shape[1]), float(shape[2]))
movie = "gym1"
frames = 180
framesp1 = frames + 1
path = "res/{movie}/uv{i}.bin"

np.set_printoptions(suppress=True)

flow = np.empty((framesp1, shape[0], shape[1], shape[2]), dtype=np.float64, order='F')
for i in range(1, framesp1):
    fp = open(path.format(movie=movie, i=i))
    flow[i,...] = np.fromfile(fp, dtype=np.float64).reshape(shape, order='F')
    fp.close()

maxx_r = 2. / float(shape[1] - 1)
maxy_r = 1. / float(shape[0] - 1)
frames_r = 1. / float(frames)

for y in range(0,shape[0]):
    sys.stdout.write("Tracing row {} . . .           \r".format(y))
    sys.stdout.flush()
    for x in range(0, shape[1]):
        pt = (y, x)
        op = np.empty((framesp1, 2))

        def add_to_output_array(index, coord):
            global op
            global maxx_r
            global maxy_r
            x = float(coord[1]) * maxx_r - 1.
            y = 2. * (1. - float(coord[0]) * maxy_r) - 1.
            op[index] = np.clip([x, y], [-1.0, -1.0], [1.0, 1.0])

        add_to_output_array(0, pt)

        def restrict_to_bounds (p, f):
            #global shape
            p2 = (p[0] + f[1], p[1] + f[0])
            return p2
            #oob = p2[0] < 0. or p2[0] >= fshape[0] or p2[1] < 0. or p2[1] >= fshape[1]
            #return p if oob else p2
            
        pt = restrict_to_bounds(pt, flow[1, pt[0], pt[1]])
        add_to_output_array(1, pt)


# now go through every frame and chase the flow
        for i in range(2, framesp1):
            def bilinear_interpolate(im, x, y):
# from https://stackoverflow.com/questions/12729228/simple-efficient-bilinear-interpolation-of-images-in-numpy-and-python
                x = np.asarray(x)
                y = np.asarray(y)
                x0 = np.floor(x).astype(int)
                x1 = x0 + 1
                y0 = np.floor(y).astype(int)
                y1 = y0 + 1
                x0 = np.clip(x0, 0, im.shape[1]-1);
                x1 = np.clip(x1, 0, im.shape[1]-1);
                y0 = np.clip(y0, 0, im.shape[0]-1);
                y1 = np.clip(y1, 0, im.shape[0]-1);
                Ia = im[ y0, x0 ]
                Ib = im[ y1, x0 ]
                Ic = im[ y0, x1 ]
                Id = im[ y1, x1 ]
                wa = (x1-x) * (y1-y)
                wb = (x1-x) * (y-y0)
                wc = (x-x0) * (y1-y)
                wd = (x-x0) * (y-y0)
                return wa*Ia + wb*Ib + wc*Ic + wd*Id
            pt = restrict_to_bounds(pt, bilinear_interpolate(flow[i], pt[1], pt[0]))
            add_to_output_array(i, pt)

        def tojson(a, path, location, frames):
            b = a[1:,:] - a[:-1,:]
            c = b.flatten()
            d = np.dot(c,c)
            go_nowhere = d < 0.005

            output = {}
            output['location'] = location
            output['frames'] = frames
            output['go_nowhere'] = 'true' if go_nowhere else 'false'
            if not go_nowhere:
                output['path'] = a.tolist()
            json.dump(output, codecs.open(path, 'w', encoding='utf-8'), separators=(',', ':'), sort_keys=True, indent=4)

        tojson(op, "paths/{}-{:04d}x{:04d}.json".format(movie, x, y), [x,y], frames)
print("Batch processing COMPLETE!                ")
