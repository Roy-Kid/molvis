import { Box } from '../src/system/box';
import { Vector3, Matrix } from '@babylonjs/core';

/**
 * Test for the Box class specifically focusing on matrix operations
 */
describe('Box Matrix Operations', () => {
    test('converting between matrix and vectors', () => {
        // Create a box from vectors
        const vectors = [
            new Vector3(10, 0, 0),
            new Vector3(0, 15, 0),
            new Vector3(0, 0, 20)
        ];
        
        const box1 = new Box(vectors);
        
        // Get the box matrix
        const matrix = box1.get_box_matrix();
        
        // Create a new box from this matrix
        const box2 = new Box(matrix);
        
        // Compare the resulting boxes
        expect(box2.get_dimensions().x).toBeCloseTo(10);
        expect(box2.get_dimensions().y).toBeCloseTo(15);
        expect(box2.get_dimensions().z).toBeCloseTo(20);
        
        // The vectors should be the same
        const resultVectors = box2.get_box_vectors();
        for (let i = 0; i < 3; i++) {
            expect(resultVectors[i].x).toBeCloseTo(vectors[i].x);
            expect(resultVectors[i].y).toBeCloseTo(vectors[i].y);
            expect(resultVectors[i].z).toBeCloseTo(vectors[i].z);
        }
    });
    
    test('transformation using BabylonJS matrix API', () => {
        // Create a non-orthogonal matrix directly
        const matrix = Matrix.FromValues(
            1, 1, 1, 0,   // First column
            1, 1, 1, 0,   // Second column
            0, 0, 1, 0,   // Third column
            0, 0, 0, 1    // Fourth column (translation)
        );
        
        const box = new Box(matrix);
        
        // Test transforming a point with both BabylonJS and our Box class
        const point = new Vector3(0, 0, 1.1);
        const transformed1 = Vector3.TransformCoordinates(point, matrix);
        const transformed2 = box.fractional_to_cartesian(point);
        
        // Results should match
        expect(transformed1.x).toBeCloseTo(transformed2.x);
        expect(transformed1.y).toBeCloseTo(transformed2.y);
        expect(transformed1.z).toBeCloseTo(transformed2.z);
    });
    
    test('creating triclinic box from lengths and angles', () => {
        const lengths = new Vector3(10, 10, 10);
        const angles = new Vector3(60, 70, 80); // alpha, beta, gamma
        
        const box = new Box(lengths, angles);
        
        // Check that angles are preserved
        const resultAngles = box.get_angles();
        expect(resultAngles.x).toBeCloseTo(60);
        expect(resultAngles.y).toBeCloseTo(70);
        expect(resultAngles.z).toBeCloseTo(80);
        
        // Check that lengths are preserved
        const resultLengths = box.get_dimensions();
        expect(resultLengths.x).toBeCloseTo(10);
        expect(resultLengths.y).toBeCloseTo(10);
        expect(resultLengths.z).toBeCloseTo(10);
    });
});
