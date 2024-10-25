import React, { useState, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Vector3, Quaternion, Matrix4 } from 'three';

// Debug component to visualize node positions
const NodePoint = ({ position }) => (
  <mesh position={position}>
    <sphereGeometry args={[0.15, 16, 16]} />
    <meshStandardMaterial color="red" />
  </mesh>
);

// Endpoint cube component
const EndCube = ({ position }) => (
  <mesh position={position}>
    <boxGeometry args={[0.8, 0.8, 0.8]} />
    <meshStandardMaterial color="#2DC4B6" />
  </mesh>
);

const Cylinder = ({ start, end, isEndpoint }) => {
  const mesh = useMemo(() => {
    const startVec = new Vector3(...start);
    const endVec = new Vector3(...end);
    const direction = endVec.clone().sub(startVec);
    const length = direction.length();
    
    // Calculate center position
    const center = startVec.clone().add(endVec).multiplyScalar(0.5);
    
    // Calculate rotation
    const quaternion = new Quaternion();
    const up = new Vector3(0, 1, 0);
    direction.normalize();
    quaternion.setFromUnitVectors(up, direction);

    const matrix = new Matrix4();
    matrix.makeRotationFromQuaternion(quaternion);

    return {
      position: center.toArray(),
      quaternion: quaternion.toArray(),
      length: length
    };
  }, [start, end]);

  return (
    <>
      <mesh
        position={mesh.position}
        quaternion={mesh.quaternion}
      >
        <cylinderGeometry args={[0.1, 0.1, mesh.length, 16]} />
        <meshStandardMaterial color="#4287f5" />
      </mesh>
      {isEndpoint && <EndCube position={end} />}
    </>
  );
};

const ThreeDModel = ({ members, nodes }) => {
  // Function to check if a node is an endpoint (connected to only one member)
  const findEndpoints = useMemo(() => {
    const nodeConnections = {};
    
    // Count connections for each node
    members.forEach(member => {
      nodeConnections[member.StartNode] = (nodeConnections[member["Start Node"]] || 0) + 1;
      nodeConnections[member.EndNode] = (nodeConnections[members["End Node"]] || 0) + 1;
    });
    
    // Return object with boolean flags for endpoints
    return nodeConnections;
  }, [members]);

  const nodePoints = useMemo(() => {
    return nodes.map((node, index) => (
      <NodePoint 
        key={`node-${index}`} 
        position={[
          parseFloat(node.X) || 0,
          parseFloat(node.Y) || 0,
          parseFloat(node.Z) || 0
        ]} 
      />
    ));
  }, [nodes]);

  const cylinders = useMemo(() => {
    return members.map((member, index) => {
      const startNode = nodes.find(n => n.Node === member["Start Node"]);
      const endNode = nodes.find(n => n.Node === member["End Node"]);

      if (!startNode || !endNode) return null;

      const start = [
        parseFloat(startNode.X) || 0,
        parseFloat(startNode.Y) || 0,
        parseFloat(startNode.Z) || 0
      ];
      const end = [
        parseFloat(endNode.X) || 0,
        parseFloat(endNode.Y) || 0,
        parseFloat(endNode.Z) || 0
      ];

      // Check if the end node is an endpoint (has only one connection)
      const isEndpoint = findEndpoints[member.EndNode] === 1;

      return (
        <Cylinder
          key={`cylinder-${index}`}
          start={start}
          end={end}
          isEndpoint={isEndpoint}
        />
      );
    });
  }, [members, nodes, findEndpoints]);

  // Calculate scene bounds
  const sceneBounds = useMemo(() => {
    if (!nodes.length) return { center: [0, 0, 0], size: 10 };

    const coords = nodes.reduce((acc, node) => {
      const x = parseFloat(node.X) || 0;
      const y = parseFloat(node.Y) || 0;
      const z = parseFloat(node.Z) || 0;
      
      acc.minX = Math.min(acc.minX, x);
      acc.maxX = Math.max(acc.maxX, x);
      acc.minY = Math.min(acc.minY, y);
      acc.maxY = Math.max(acc.maxY, y);
      acc.minZ = Math.min(acc.minZ, z);
      acc.maxZ = Math.max(acc.maxZ, z);
      return acc;
    }, { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity });

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
        {nodePoints}
        {cylinders}
      </group>
      
      <gridHelper args={[20, 20]} />
      <axesHelper args={[5]} />
      <OrbitControls enableDamping dampingFactor={0.05} />
    </Canvas>
  );
};

export default ThreeDModel;