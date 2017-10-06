import cv2 as cv
import numpy as np
import scipy as sp
import skvideo.io
import json, codecs

shape = (360,640,2)
movie = "gym1"
frames = 180

np.set_printoptions(suppress=True)

# PHASE 1 -- Allow user to select a point from the first frame

vid = skvideo.io.VideoCapture("res/{movie}.avi".format(movie=movie))
retval, frame = vid.read()
if not retval:
    print("Failed to open file.")
    exit()
selected = False

def draw_pt(frame, p):
    pt = (int(p[1]), int(p[0]))
    cv.circle(frame, pt, 5, (0, 255, 255), 1)

def mouse_callback(event, x, y, flags, param):
    global selected
    global pt
    if event == cv.EVENT_LBUTTONUP:
        pt = (y,x)
        draw_pt(frame, pt)
        selected = True

cv.namedWindow('Video')
cv.setMouseCallback('Video', mouse_callback)
frame = cv.cvtColor(frame, cv.COLOR_BGR2RGB)
cv.imshow('Video', frame)

while not selected:
    if cv.waitKey(50) is not -1:
        exit()

# PHASE 2 -- Trace that point through the whole video based on flow
op = np.empty((frames + 1, 2))
def add_to_output_array(index, coord):
    global op
    maxx = float(shape[1] - 1)
    maxy = float(shape[0] - 1)
    x = 2. * float(coord[1]) / maxx - 1.
    y = 2. * (1. - float(coord[0]) / maxy) - 1.
    op[index] = [x, y]

add_to_output_array(0, pt)
path = "res/{movie}/uv{i}.bin"
fp = open(path.format(movie=movie, i=1))
flow = np.fromfile(fp, dtype=np.float64).reshape(shape, order='F')
fp.close()

def restrict_to_bounds (p, f):
    global shape
    p2 = (p[0] + f[1], p[1] + f[0])
    oob = p2[0] < 0. or p2[0] >= float(shape[0]) or p2[1] < 0. or p2[1] >= float(shape[1])
    return p if oob else p2
    
print("{pt} += {flow} = ".format(pt=pt, flow=flow[pt]))
pt = restrict_to_bounds(pt, flow[pt])
print("    {pt}".format(pt=pt))
add_to_output_array(1, pt)

retval, frame = vid.read()
draw_pt(frame, pt)
frame = cv.cvtColor(frame, cv.COLOR_BGR2RGB)
cv.imshow('Video', frame)

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

# now go through every frame and chase the flow
for i in range(2, frames + 1):
    fp = open(path.format(movie=movie, i=i))
    flow = np.fromfile(fp, dtype=np.float64).reshape(shape, order='F')
    fp.close()
    pt = restrict_to_bounds(pt, bilinear_interpolate(flow, pt[1], pt[0]))
    add_to_output_array(i, pt)
    retval, frame = vid.read()
    draw_pt(frame, pt)
    frame = cv.cvtColor(frame, cv.COLOR_BGR2RGB)
    cv.imshow('Video', frame)
    cv.waitKey(1)
print(op)

def tojson(a, path):
    b = a[1:,:] - a[:-1,:]
    c = b.flatten()
    d = np.dot(c,c)
    go_nowhere = d < 0.001

    output = {}
    output['go_nowhere'] = 'true' if go_nowhere else 'false'
    if not go_nowhere:
        output['path'] = a.tolist()
    
    json.dump(output, codecs.open(path, 'w', encoding='utf-8'), separators=(',', ':'), sort_keys=True, indent=4)

tojson(op, "out.json")
