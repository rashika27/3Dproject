import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Vector3, Quaternion } from 'three';

// Cube component to replace node points at specific locations
const Cube = ({ position }) => (
  <mesh position={position}>
    <boxGeometry args={[6, 6, 6]} /> {/* Increased from 0.5 to 1.5 */}
    <meshStandardMaterial 
      color="#ff4444"
      roughness={0.5}
      metalness={0.2}
    />
  </mesh>
);

// Cylinder component between start and end nodes
const Cylinder = ({ start, end }) => {
  const mesh = useMemo(() => {
    try {
      const startVec = new Vector3(...start);
      const endVec = new Vector3(...end);
      const direction = endVec.clone().sub(startVec);
      const length = direction.length();

      if (length < 0.1) {
        console.warn('Very small cylinder length detected:', length, { start, end });
      }

      const center = startVec.clone().add(endVec).multiplyScalar(0.5);
      const quaternion = new Quaternion();
      const up = new Vector3(0, 1, 0);
      direction.normalize();
      quaternion.setFromUnitVectors(up, direction);

      return {
        position: center,
        rotation: quaternion,
        length: length
      };
    } catch (error) {
      console.error('Error creating cylinder:', error, { start, end });
      return null;
    }
  }, [start, end]);

  if (!mesh) return null;

  return (
    <group position={[mesh.position.x, mesh.position.y, mesh.position.z]}>
      <mesh quaternion={mesh.rotation}>
        <cylinderGeometry args={[0.1, 0.1, mesh.length, 16]} />
        <meshStandardMaterial color="#4287f5" />
      </mesh>
    </group>
  );
};

const ThreeDModel = ({ members, nodes }) => {
  useEffect(() => {
    console.log('Data received:', { members, nodes });
  }, [members, nodes]);

  // Create cubes for specific members
  const cubes = useMemo(() => {
    if (!members || !nodes || members.length === 0 || nodes.length === 0) {
      console.warn('No data available for cubes');
      return [];
    }

    const specialMembers = [0, 11, 4]; // indices for 1st and 12th members (0-based index)
    const cubePositions = new Set();
    
    specialMembers.forEach(memberIndex => {
      if (members[memberIndex]) {
        const member = members[memberIndex];
        const startNode = nodes.find(n => n.Node === member.StartNode);
        const endNode = nodes.find(n => n.Node === member.EndNode);
        
        if (startNode) {
          cubePositions.add(JSON.stringify([
            parseFloat(startNode.X),
            parseFloat(startNode.Y),
            parseFloat(startNode.Z)
          ]));
        }
        if (endNode) {
          cubePositions.add(JSON.stringify([
            parseFloat(endNode.X),
            parseFloat(endNode.Y),
            parseFloat(endNode.Z)
          ]));
        }
      }
    });

    return Array.from(cubePositions).map((posString, index) => {
      const position = JSON.parse(posString);
      return <Cube key={`cube-${index}`} position={position} />;
    });
  }, [members, nodes]);

  // Create cylinders
  const cylinders = useMemo(() => {
    if (!members || !nodes || members.length === 0 || nodes.length === 0) {
      console.warn('No data available for cylinders');
      return [];
    }

    return members.map((member, index) => {
      const startNode = nodes.find(n => n.Node === member.StartNode);
      const endNode = nodes.find(n => n.Node === member.EndNode);

      if (!startNode || !endNode) {
        console.warn(`Missing node data for member:`, member);
        return null;
      }

      const start = [parseFloat(startNode.X), parseFloat(startNode.Y), parseFloat(startNode.Z)];
      const end = [parseFloat(endNode.X), parseFloat(endNode.Y), parseFloat(endNode.Z)];

      return (
        <Cylinder
          key={`cylinder-${index}`}
          start={start}
          end={end}
        />
      );
    }).filter(Boolean);
  }, [members, nodes]);

  // Calculate scene bounds
  const sceneBounds = useMemo(() => {
    if (!nodes || nodes.length === 0) return { center: [0, 0, 0], size: 10 };

    const coords = nodes.reduce(
      (acc, node) => {
        const x = parseFloat(node.X);
        const y = parseFloat(node.Y);
        const z = parseFloat(node.Z);

        acc.minX = Math.min(acc.minX, x);
        acc.maxX = Math.max(acc.maxX, x);
        acc.minY = Math.min(acc.minY, y);
        acc.maxY = Math.max(acc.maxY, y);
        acc.minZ = Math.min(acc.minZ, z);
        acc.maxZ = Math.max(acc.maxZ, z);
        return acc;
      },
      { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity }
    );

    const center = [
      (coords.minX + coords.maxX) / 2,
      (coords.minY + coords.maxY) / 2,
      (coords.minZ + coords.maxZ) / 2
    ];

    const size = Math.max(
      coords.maxX - coords.minX,
      coords.maxY - coords.minY,
      coords.maxZ - coords.minZ
    ) * 1.5;

    return { center, size };
  }, [nodes]);

  return (
    <Canvas
      camera={{
        position: [
          sceneBounds.center[0] + sceneBounds.size,
          sceneBounds.center[1] + sceneBounds.size,
          sceneBounds.center[2] + sceneBounds.size
        ],
        fov: 50
      }}
      style={{ height: '80vh' }}
    >
      <color attach="background" args={['#f0f0f0']} />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <directionalLight position={[-10, 10, 5]} intensity={1} />
      
      <group position={[-sceneBounds.center[0], -sceneBounds.center[1], -sceneBounds.center[2]]}>
        {cylinders}
        {cubes}
      </group>
      <OrbitControls enableDamping dampingFactor={0.05} />
    </Canvas>
  );
};

const App = () => {
  const [members, setMembers] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [error, setError] = useState(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Get data from first two sheets
        const membersData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        const nodesData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[1]]);

        console.log('Raw Excel Data:', { membersData, nodesData });

        if (!membersData.length || !nodesData.length) {
          throw new Error('Invalid data in Excel file');
        }

        // Process nodes data
        const processedNodes = nodesData.map(node => ({
          Node: node.Node?.toString(),
          X: parseFloat(node.X) || 0,
          Y: parseFloat(node.Y) || 0,
          Z: parseFloat(node.Z) || 0
        }));

        // Process members data
        const processedMembers = membersData.map(member => ({
          StartNode: member["Start Node"]?.toString(),
          EndNode: member["End Node"]?.toString()
        }));

        console.log('Processed Data:', {
          members: processedMembers,
          nodes: processedNodes
        });

        setMembers(processedMembers);
        setNodes(processedNodes);
        setError(null);

      } catch (error) {
        console.error('Error processing file:', error);
        setError(`Error processing file: ${error.message}`);
        setMembers([]);
        setNodes([]);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="App">
      <h2>3D Structure Viewer</h2>
      <div style={{ margin: '20px 0' }}>
        <input 
          type="file" 
          accept=".xlsx, .xls" 
          onChange={handleFileUpload}
          style={{ marginRight: '10px' }}
        />
        {error && (
          <div style={{ color: 'red', marginTop: '10px' }}>
            {error}
          </div>
        )}
        {members.length > 0 && (
          <div style={{ color: 'green', marginTop: '10px' }}>
            Loaded {members.length} members and {nodes.length} nodes
          </div>
        )}
      </div>
      
      {members.length > 0 && nodes.length > 0 ? (
        <div style={{ 
          width: '100%', 
          height: '80vh', 
          border: '1px solid #ccc',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <ThreeDModel members={members} nodes={nodes} />
        </div>
      ) : (
        <p>Upload an Excel file to visualize the 3D structure.</p>
      )}
    </div>
  );
};

export default App;