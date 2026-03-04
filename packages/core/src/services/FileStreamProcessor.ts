import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';

export interface StreamOptions {
  chunkSize?: number; // 默认 64KB
  maxSize?: number; // 最大文件大小限制，默认 10MB
}

export class FileStreamProcessor {
  private defaultOptions: StreamOptions = {
    chunkSize: 64 * 1024, // 64KB
    maxSize: 10 * 1024 * 1024, // 10MB
  };

  /**
   * 检查文件大小是否超过限制
   */
  async isFileSizeAcceptable(
    filePath: string,
    options?: StreamOptions,
  ): Promise<boolean> {
    const opts = { ...this.defaultOptions, ...options };
    try {
      const stats = await fs.stat(filePath);
      return stats.size <= (opts.maxSize ?? this.defaultOptions.maxSize!);
    } catch (_error) {
      // Failed to stat file
      return false;
    }
  }

  /**
   * 流式读取大文件内容
   */
  async streamFileContent(
    filePath: string,
    options?: StreamOptions,
  ): Promise<string> {
    const opts = { ...this.defaultOptions, ...options };

    // 检查文件大小
    if (!(await this.isFileSizeAcceptable(filePath, options))) {
      throw new Error(
        `File ${filePath} exceeds maximum size limit of ${opts.maxSize} bytes`,
      );
    }

    const chunks: Buffer[] = [];
    const readableStream = createReadStream(filePath);

    // 使用管道和转换流来处理数据块
    const transformStream = new Transform({
      transform(
        chunk: Buffer,
        encoding: string,
        callback: (error?: Error | null, data?: Buffer) => void,
      ) {
        chunks.push(chunk);
        callback(null);
      },
    });

    await pipeline(readableStream, transformStream);
    return Buffer.concat(chunks).toString('utf-8');
  }

  /**
   * 流式处理大文件，对每一部分应用转换函数
   */
  async processLargeFile(
    filePath: string,
    processor: (chunk: Buffer, index: number) => Promise<unknown>,
    options?: StreamOptions,
  ): Promise<void> {
    const opts = { ...this.defaultOptions, ...options };

    // 检查文件大小
    if (!(await this.isFileSizeAcceptable(filePath, options))) {
      throw new Error(
        `File ${filePath} exceeds maximum size limit of ${opts.maxSize} bytes`,
      );
    }

    const readableStream = createReadStream(filePath, {
      highWaterMark: opts.chunkSize,
    });

    let chunkIndex = 0;
    const processStream = new Transform({
      transform(
        chunk: Buffer,
        encoding: string,
        callback: (error?: Error | null, data?: Buffer) => void,
      ) {
        // 异步处理当前块
        processor(chunk, chunkIndex++)
          .then(() => callback(null, chunk))
          .catch((error) => callback(error));
      },
    });

    await pipeline(readableStream, processStream);
  }

  /**
   * 流式复制大文件
   */
  async copyLargeFile(
    sourcePath: string,
    destinationPath: string,
    options?: StreamOptions,
  ): Promise<void> {
    const opts = { ...this.defaultOptions, ...options };

    // 检查源文件大小
    if (!(await this.isFileSizeAcceptable(sourcePath, options))) {
      throw new Error(
        `Source file ${sourcePath} exceeds maximum size limit of ${opts.maxSize} bytes`,
      );
    }

    const sourceStream = createReadStream(sourcePath);
    const destStream = createWriteStream(destinationPath);

    await pipeline(sourceStream, destStream);
  }

  /**
   * 获取大文件的前几行（用于预览）
   */
  async getFirstLines(
    filePath: string,
    numLines: number = 10,
    options?: StreamOptions,
  ): Promise<string[]> {
    const opts = { ...this.defaultOptions, ...options };

    if (!(await this.isFileSizeAcceptable(filePath, options))) {
      throw new Error(
        `File ${filePath} exceeds maximum size limit of ${opts.maxSize} bytes`,
      );
    }

    const lines: string[] = [];
    const readableStream = createReadStream(filePath, { encoding: 'utf-8' });

    let buffer = '';
    let linesCount = 0;

    return new Promise((resolve, reject) => {
      readableStream.on('data', (chunk: Buffer | string) => {
        buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf-8');

        let newLineIndex;
        while (
          (newLineIndex = buffer.indexOf('\n')) !== -1 &&
          linesCount < numLines
        ) {
          const line = buffer.substring(0, newLineIndex);
          lines.push(line);
          buffer = buffer.substring(newLineIndex + 1);
          linesCount++;
        }

        if (linesCount >= numLines) {
          readableStream.destroy(); // 停止读取更多数据
          resolve(lines);
        }
      });

      readableStream.on('end', () => {
        // 如果文件结束但还没有足够的行数
        if (buffer && linesCount < numLines) {
          lines.push(buffer);
        }
        resolve(lines);
      });

      readableStream.on('error', (error) => {
        reject(error);
      });
    });
  }
}
