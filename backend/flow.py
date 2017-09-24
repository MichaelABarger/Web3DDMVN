import cv2
import numpy
import skvideo.io


folder = 'res/gym1'
dims = [640, 360, 2]
pixels = dims[0] * dims[1]
words = pixels * dims[2]


vid = skvideo.io.VideoCapture('res/gym1.avi')

retval, prev = vid.read()
if not retval:
    print "Failed to open file."
    exit()
prev = cv2.cvtColor(prev, cv2.COLOR_BGR2GRAY)

def draw_flow(flow):
    h, w = flow.shape[:2]
    fx, fy = flow[:,:,0], flow[:,:,1]
    ang = numpy.arctan2(fy, fx) + numpy.pi
    v = numpy.sqrt(fx*fx+fy*fy)
    hsv = numpy.zeros((h, w, 3), numpy.uint8)
    hsv[...,0] = ang*(180/numpy.pi/2)
    hsv[...,1] = 255
    hsv[...,2] = numpy.minimum(v * 64, 255)
    bgr = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
    return bgr, hsv[...,2]

params = cv2.SimpleBlobDetector_Params()
params.filterByArea = True
params.minArea = 100
detector = cv2.SimpleBlobDetector_create(params)
while True:
    retval, fr = vid.read()
    if not retval:
        break
    frame = cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY)
    flow = cv2.calcOpticalFlowFarneback(prev, frame, None, 0.5, 12, 25, 5, 7, 1.5, cv2.OPTFLOW_FARNEBACK_GAUSSIAN)
    print flow.shape
    prev = frame
    hsv, mag = draw_flow(flow)

    threshold = numpy.vectorize(lambda x: x if x >= 60 else 0, [numpy.uint8])
    mag = threshold(mag)
    
    mag = cv2.bitwise_not(mag)
    keypoints = detector.detect(mag)
    mag = cv2.bitwise_not(mag)
    mag = cv2.drawKeypoints(mag, keypoints, numpy.array([]), (0,0,255), cv2.DRAW_MATCHES_FLAGS_DRAW_RICH_KEYPOINTS)

    m = cv2.addWeighted(mag, 0.8, fr, 0.2, 0)
    # h = cv2.addWeighted(hsv, 0.8, fr, 0.2, 0)

    # cv2.imshow("Frame Flow", h)
    cv2.imshow("Frame Mag", m)


    if cv2.waitKey(1) is not -1:
        exit()

