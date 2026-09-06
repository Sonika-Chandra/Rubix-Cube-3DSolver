"""import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
fig=plt.figure()
ax=fig.add_subplot(111, projection='3d')
spacing=1.1

for x in [-1,0,1]:
    for y in [-1,0,1]:
        for z in [-1,0,1]:
            cx=x*spacing
            cy=y*spacing    
            cz=z*spacing
            half=0.45
            if x!=0 and y!=0 and z!=0:
                px='+x' if x==1 else '-x'
                py='+y' if y==1 else '-y'
                pz='+z' if z==1 else '-z'   
                face_x = cx + half if px == '+x' else cx - half
                face_y = cy + half if py == '+y' else cy - half
                face_z = cz + half if pz == '+z' else cz - half
                fz=[[cx-half,cy-half,face_z],[cx-half,cy+half,face_z],[cx+half,cy+half,face_z],[cx+half,cy-half,face_z]]
                fy = [[cx-half, face_y, cz-half],[cx-half, face_y, cz+half],[cx+half, face_y, cz+half],[cx+half, face_y, cz-half]]
                fx = [[face_x, cy-half, cz-half],[face_x, cy+half, cz-half],[face_x, cy+half, cz+half],[face_x, cy-half, cz+half]]

                FColor ={'+x':'red','-x':'orange','+y':'blue','-y':'green','+z':'white','-z':'yellow'}
                for fp,dir in [(fx,px),(fy,py),(fz,pz)]:
                    poly=Poly3DCollection([fp],facecolor=FColor[dir],edgecolor='black',linewidth=0.5)
                    ax.add_collection3d(poly)
            

ax.set_box_aspect([1,1,1])
plt.show()"""

import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

fig = plt.figure()
ax = fig.add_subplot(111, projection='3d')
spacing = 1.1
half = 0.45

FColor = {'+x':'red', '-x':'orange', '+y':'blue', '-y':'green', '+z':'white', '-z':'yellow'}
point={}
def face(axis, sign, cx, cy, cz):
    if axis == 'x':
        fx_val = cx + half if sign == 1 else cx - half
        return [[fx_val, cy-half, cz-half], [fx_val, cy+half, cz-half],
                [fx_val, cy+half, cz+half], [fx_val, cy-half, cz+half]]
    if axis == 'y':
        fy_val = cy + half if sign == 1 else cy - half
        return [[cx-half, fy_val, cz-half], [cx-half, fy_val, cz+half],
                [cx+half, fy_val, cz+half], [cx+half, fy_val, cz-half]]
    if axis == 'z':
        fz_val = cz + half if sign == 1 else cz - half
        return [[cx-half, cy-half, fz_val], [cx-half, cy+half, fz_val],
                [cx+half, cy+half, fz_val], [cx+half, cy-half, fz_val]]

for x in [-1, 0, 1]:
    for y in [-1, 0, 1]:
        for z in [-1, 0, 1]:
            if x == 0 and y == 0 and z == 0:
                continue  # skip the hidden center piece

            cx, cy, cz = x*spacing, y*spacing, z*spacing
            nonzero_count = (x != 0) + (y != 0) + (z != 0)

            faces_to_draw = []
            if x != 0:
                faces_to_draw.append(('x', x))
            if y != 0:
                faces_to_draw.append(('y', y))
            if z != 0:
                faces_to_draw.append(('z', z))

            for axis, sign in faces_to_draw:
                direction = ('+' if sign == 1 else '-') + axis
                fp = face(axis, sign, cx, cy, cz)
                poly = Poly3DCollection([fp], facecolor=FColor[direction], edgecolor='black', linewidth=0.5)
                ax.add_collection3d(poly)
                point[poly]=((x,y,z),direction,)

ax.set_box_aspect([1,1,1])

press_pos = None
def callback_func(event):
    global press_pos 
    press_pos=(event.mouseevent.x, event.mouseevent.y)
    print("pressed at:", press_pos)
    print(point[event.artist])
    
def on_release(event):
    global press_pos
    if press_pos is None:
        return                 # no face was picked before this release, ignore it
    release_pos = (event.x, event.y)
    print("released at:", release_pos)

fig.canvas.mpl_connect('pick_event', on_pick)
fig.canvas.mpl_connect('button_release_event', on_release)

plt.show()


