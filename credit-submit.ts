#!/usr/bin/env bun
/**
 * Nosana Credit Fix - Submit jobs using CLI API flag
 * Bypasses SDK gas requirements by using direct API authentication
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

const MARKET_4090 = '97G9NnvBDQ2WpKu6fasoMsAKmfj63C9rhysJnkeWodAf';
const API_URL = 'https://api.nosana.io';

interface JobConfig {
  prompt: string;
  duration: number;
  width?: number;
  height?: number;
}

interface JobResult {
  address: string;
  state: string;
  ipfsHash?: string;
}

export async function submitWithCredits(config: JobConfig): Promise<JobResult> {
  const jobId = randomUUID().slice(0, 8);
  const tempDir = `/tmp/nosana-jobs/${jobId}`;
  
  mkdirSync(tempDir, { recursive: true });
  
  // Build job definition
  const jobDef = {
    version: '0.1',
    type: 'container/run',
    ops: [{
      type: 'container/run',
      id: 'video-gen',
      args: {
        image: 'jrottenberg/ffmpeg:4.4-alpine',
        cmd: ['sh', '-c', `
          ffmpeg -f lavfi -i testsrc=duration=${config.duration}:size=${config.width || 1280}x${config.height || 720}:rate=30 \
                 -pix_fmt yuv420p /output/video.mp4 && \
          echo "VIDEO_COMPLETE" && \
          ls -lh /output/
        `],
        resources: {
          cpu: 2,
          memory: '2GB'
        }
      }
    }]
  };
  
  const jobFile = `${tempDir}/job.json`;
  writeFileSync(jobFile, JSON.stringify(jobDef, null, 2));
  
  console.log(`📤 Submitting job via CLI API...`);
  console.log(`   Prompt: ${config.prompt}`);
  console.log(`   Duration: ${config.duration}s`);
  
  // Use CLI with --api flag (handles credits natively)
  const result = execSync(
    `nosana job post \
      --market ${MARKET_4090} \
      --timeout ${Math.max(config.duration * 30, 60)} \
      --job ${jobFile} \
      --api ${API_URL} \
      --output json`,
    { encoding: 'utf-8', timeout: 30000 }
  );
  
  const jobInfo = JSON.parse(result);
  
  return {
    address: jobInfo.address || jobInfo.job,
    state: jobInfo.state || 'queued',
    ipfsHash: jobInfo.ipfsJob
  };
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const prompt = args[0] || 'test video';
  const duration = parseInt(args[1]) || 3;
  
  submitWithCredits({ prompt, duration })
    .then(result => {
      console.log('\n✅ Job submitted!');
      console.log(`   Address: ${result.address}`);
      console.log(`   State: ${result.state}`);
      console.log(`\n🔍 Monitor with:`);
      console.log(`   nosana job get ${result.address}`);
    })
    .catch(err => {
      console.error('❌ Failed:', err.message);
      process.exit(1);
    });
}
