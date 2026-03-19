#!/usr/bin/env bun
/**
 * Monitor Nosana job status until completion
 */

import { execSync } from 'child_process';

interface JobStatus {
  address: string;
  state: 'queued' | 'running' | 'completed' | 'stopped';
  node?: string;
  ipfsResult?: string;
  timeStart?: number;
  timeEnd?: number;
}

export async function monitorJob(address: string, pollInterval = 5000): Promise<JobStatus> {
  console.log(`🔍 Monitoring job ${address}...\n`);
  
  while (true) {
    try {
      const result = execSync(
        `nosana job get ${address} --output json`,
        { encoding: 'utf-8', timeout: 10000 }
      );
      
      const job = JSON.parse(result) as JobStatus;
      
      // Log status
      const statusEmoji = {
        queued: '⏳',
        running: '🏃',
        completed: '✅',
        stopped: '⛔'
      }[job.state] || '❓';
      
      process.stdout.write(`\r${statusEmoji} ${job.state.toUpperCase()} `);
      
      if (job.node) {
        process.stdout.write(`| Node: ${job.node.slice(0, 8)}... `);
      }
      
      // Check if done
      if (job.state === 'completed' || job.state === 'stopped') {
        console.log('\n');
        return job;
      }
      
      // Wait before next poll
      await new Promise(r => setTimeout(r, pollInterval));
      
    } catch (err) {
      console.error('\n❌ Monitor error:', err.message);
      await new Promise(r => setTimeout(r, pollInterval));
    }
  }
}

// CLI usage
if (require.main === module) {
  const jobAddress = process.argv[2];
  
  if (!jobAddress) {
    console.error('Usage: bun run monitor.ts <job-address>');
    process.exit(1);
  }
  
  monitorJob(jobAddress)
    .then(job => {
      console.log('Final status:', job.state);
      if (job.ipfsResult) {
        console.log('Output IPFS:', job.ipfsResult);
      }
    })
    .catch(console.error);
}
