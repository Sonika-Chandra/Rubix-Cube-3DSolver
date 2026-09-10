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
dir_vecs = {'+x':(1,0,0), '-x':(-1,0,0), '+y':(0,1,0), '-y':(0,-1,0), '+z':(0,0,1), '-z':(0,0,-1)}
vec_to_dir = {v: k for k, v in dir_vecs.items()}
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
    face_axis = direction[1]
    value = pos[axis_index[face_axis]]

    dx = release_pos[0] - press_pos[0]
    dy = release_pos[1] - press_pos[1]

    # revert old highlight regardless
    if current_layer is not None:
        for poly in current_layer:
            poly.set_edgecolor('black')

    if abs(dx) < 5 and abs(dy) < 5:
        # too small to count as a drag - just deselect
        press_poly.set_edgecolor('black')
        fig.canvas.draw_idle()
        current_layer = None
        press_pos = None
        press_poly = None
        return

    # rotation axis = the clicked face's own axis (simplification)
    axis = face_axis
    clockwise = dx > 0 if abs(dx) > abs(dy) else dy < 0

    layer_polys = get_layer(axis, value)
    old_data = [(p, point[p][0], point[p][1], p.get_facecolor()) for p in layer_polys]

    for p in layer_polys:
        p.remove()
        del point[p]

    new_layer = []
    for poly, old_pos, old_dir, color in old_data:
        new_pos = rotate_position(old_pos, axis, clockwise)
        new_dvec = rotate_position(dir_vecs[old_dir], axis, clockwise)
        new_dir = vec_to_dir[new_dvec]

        ncx, ncy, ncz = new_pos[0]*spacing, new_pos[1]*spacing, new_pos[2]*spacing
        sign = 1 if new_dir[0] == '+' else -1
        fp = face(new_dir[1], sign, ncx, ncy, ncz)

        newpoly = Poly3DCollection([fp], facecolor=color, edgecolor='black', linewidth=0.5, picker=True)
        ax.add_collection3d(newpoly)
        point[newpoly] = (new_pos, new_dir)
        new_layer.append(newpoly)

    fig.canvas.draw_idle()
    current_layer = new_layer
    press_pos = None
    press_poly = None

def rotate_position(pos, axis, clockwise):
    x, y, z = pos
    if axis == 'x':
        if clockwise:
            new_y, new_z = z, -y
        else:
            new_y, new_z = -z, y
        return (x, new_y, new_z)
    if axis == 'y':
        if clockwise:
            new_z, new_x = x, -z
        else:
            new_z, new_x = -x, z
        return (new_x, y, new_z)
    if axis == 'z':
        if clockwise:
            new_x, new_y = y, -x
        else:
            new_x, new_y = -y, x
        return (new_x, new_y, z)

fig.canvas.mpl_connect('pick_event', on_pick)
fig.canvas.mpl_connect('button_release_event', on_release)
plt.show()


