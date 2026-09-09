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
                poly = Poly3DCollection([fp], facecolor=FColor[direction], edgecolor='black', linewidth=4,picker=True)
                ax.add_collection3d(poly)
                point[poly]=((x,y,z),direction,)

ax.set_box_aspect([1,1,1])

press_pos = None
press_poly = None
current_layer = None  
axis_index = {'x': 0, 'y': 1, 'z': 2}

def get_layer(axis, value):
    idx = axis_index[axis]
    layer_polys = []
    for poly, (pos, direction) in point.items():
        if pos[idx] == value:
            layer_polys.append(poly)
    return layer_polys

def on_pick(event):
    global press_pos, press_poly
    press_pos = (event.mouseevent.x, event.mouseevent.y)
    press_poly = event.artist
    press_poly.set_edgecolor('cyan')
    fig.canvas.draw_idle()

def on_release(event):
    global press_pos, press_poly, current_layer
    if press_pos is None or press_poly is None:
        return
    release_pos = (event.x, event.y)

    pos, direction = point[press_poly]
    axis = direction[1]
    value = pos[axis_index[axis]]

    # revert the PREVIOUSLY highlighted layer, if one exists
    if current_layer is not None:
        for poly in current_layer:
            poly.set_edgecolor('black')

    # highlight the NEW layer
    layer = get_layer(axis, value)
    for poly in layer:
        poly.set_edgecolor('cyan')
    fig.canvas.draw_idle()

    current_layer = layer  # remember this layer for next time

    press_pos = None
    press_poly = None

def rotate_position(pos,axis,clockwise):
    x, y, z = pos
    if axis == 'z':
        if clockwise:
            new_x, new_y = y, -x
        else:
            new_x, new_y = -y, x
        return (new_x, new_y, z)
    if axis == 'x':
        if clockwise:
            new_y, new_z = -z, y
        else:
            new_y, new_z = z, -y
        return (x, new_y, new_z)

print(rotate_position((1, 1, 1), 'x', True))
print(rotate_position((1, 1, 1), 'x', False))
print(rotate_position((1, 1, -1), 'x', True))
print(len(get_layer('x', 1)))
fig.canvas.mpl_connect('pick_event', on_pick)
fig.canvas.mpl_connect('button_release_event', on_release)
plt.show()


