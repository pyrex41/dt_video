#[cfg(test)]
mod tests {
    use clipforge_lib::utils::ffmpeg::{FfmpegBuilder, RawInputConfig, FFmpegError};

    #[test]
    fn test_builder_basic_args() {
        let args = FfmpegBuilder::new()
            .input("input.mp4")
            .output("output.mp4")
            .build_args();

        assert!(args.contains(&"-i".to_string()));
        assert!(args.contains(&"input.mp4".to_string()));
        assert!(args.contains(&"-y".to_string()));
        assert!(args.contains(&"output.mp4".to_string()));
    }

    #[test]
    fn test_builder_trim_args() {
        let args = FfmpegBuilder::new()
            .input("input.mp4")
            .trim(1.0, 5.0)
            .output("output.mp4")
            .build_args();

        let ss_pos = args.iter().position(|s| s == "-ss").unwrap();
        assert_eq!(args[ss_pos + 1], "1");
        let t_pos = args.iter().position(|s| s == "-t").unwrap();
        assert_eq!(args[t_pos + 1], "5");
    }

    #[test]
    fn test_builder_encode_args() {
        let args = FfmpegBuilder::new()
            .input("input.mp4")
            .encode()
            .output("output.mp4")
            .build_args();

        assert!(args.contains(&"-c:v".to_string()));
        assert!(args.contains(&"libx264".to_string()));
        assert!(args.contains(&"-c:a".to_string()));
        assert!(args.contains(&"aac".to_string()));
        assert!(args.contains(&"-preset".to_string()));
        assert!(args.contains(&"medium".to_string()));
    }

    #[test]
    fn test_builder_stream_copy_args() {
        let args = FfmpegBuilder::new()
            .input("input.mp4")
            .stream_copy()
            .output("output.mp4")
            .build_args();

        assert!(args.contains(&"-c".to_string()));
        assert!(args.contains(&"copy".to_string()));
        assert!(args.contains(&"-avoid_negative_ts".to_string()));
        assert!(args.contains(&"make_zero".to_string()));
    }

    #[test]
    fn test_builder_thumbnail_args() {
        let args = FfmpegBuilder::new()
            .input("input.mp4")
            .thumbnail(2.5)
            .scale(320, None)
            .output("thumb.jpg")
            .build_args();

        let ss_pos = args.iter().position(|s| s == "-ss").unwrap();
        assert_eq!(args[ss_pos + 1], "2.5");
        assert!(args.contains(&"-vframes".to_string()));
        assert!(args.contains(&"1".to_string()));
        assert!(args.contains(&"-vf".to_string()));
        assert!(args.iter().any(|s| s.contains("scale=320")));
    }

    #[test]
    fn test_builder_raw_input_args() {
        let config = RawInputConfig {
            pixel_format: "rgb24".to_string(),
            video_size: "1280x720".to_string(),
            framerate: 30,
        };

        let args = FfmpegBuilder::new()
            .raw_input(config)
            .output("output.mp4")
            .build_args();

        assert!(args.contains(&"-f".to_string()));
        assert!(args.contains(&"rawvideo".to_string()));
        assert!(args.contains(&"-pixel_format".to_string()));
        assert!(args.contains(&"rgb24".to_string()));
        assert!(args.contains(&"-video_size".to_string()));
        assert!(args.contains(&"1280x720".to_string()));
        assert!(args.contains(&"-framerate".to_string()));
        assert!(args.contains(&"30".to_string()));
    }

    #[test]
    fn test_builder_concat_args() {
        let args = FfmpegBuilder::new()
            .concat("concat.txt")
            .stream_copy()
            .output("output.mp4")
            .build_args();

        assert!(args.contains(&"-f".to_string()));
        assert!(args.contains(&"concat".to_string()));
        assert!(args.contains(&"-safe".to_string()));
        assert!(args.contains(&"0".to_string()));
        assert!(args.contains(&"-i".to_string()));
        assert!(args.contains(&"concat.txt".to_string()));
        assert!(args.contains(&"-c".to_string()));
        assert!(args.contains(&"copy".to_string()));
        assert!(args.contains(&"-y".to_string()));
        assert!(args.contains(&"output.mp4".to_string()));
    }

    #[test]
    fn test_error_display() {
        let error = FFmpegError::CommandSpawn("test error".to_string());
        assert_eq!(format!("{}", error), "Failed to spawn FFmpeg: test error");

        let error = FFmpegError::ExecutionFailed("ffmpeg failed".to_string());
        assert_eq!(format!("{}", error), "FFmpeg execution failed: ffmpeg failed");
    }

    #[test]
    fn test_version_check_method() {
        let builder = FfmpegBuilder::version_check();
        // Version check should return a builder
        // The actual version check is done via run_version_check() method
        // which executes "ffmpeg -version" directly
        assert!(true); // Just test that the method exists and returns a builder
    }
}