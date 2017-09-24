import numpy as np
import cv2

def draw_flow(flow):
    h, w = flow.shape[:2]
    fx, fy = flow[:,:,0], flow[:,:,1]
    ang = np.arctan2(fy, fx) + np.pi
    v = np.sqrt(fx*fx+fy*fy)
    hsv = np.zeros((h, w, 3), np.uint8)
    hsv[...,0] = ang*(180/np.pi/2)
    hsv[...,1] = 255
    hsv[...,2] = np.minimum(v * 64, 255)
    bgr = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
    return bgr, hsv[...,2]

shape = (360,640,2)
tp = np.float64

while True:
    for i in range(1, 180):
        fp = open("res/gym1/uv{index}.bin".format(index=i))
        flow = np.fromfile(fp, dtype=tp).reshape(shape, order='F')
        fp.close()
        hsv, mag = draw_flow(flow)
        cv2.imshow('Flow', hsv)

        if cv2.waitKey(1) is not -1:
            exit()
