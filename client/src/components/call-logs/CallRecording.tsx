import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Mic, StopCircle, Upload, Play, Pause, Clock, Volume2, VolumeX, Trash2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';

interface CallRecordingProps {
  callId: number;
  existingRecordingUrl?: string;
  mode?: 'create' | 'view';
  onRecordingComplete?: (url: string) => void;
  onRecordingDeleted?: () => void;
}

const CallRecording: React.FC<CallRecordingProps> = ({
  callId,
  existingRecordingUrl,
  mode = 'view',
  onRecordingComplete,
  onRecordingDeleted
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(existingRecordingUrl || null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Initialize audio player if we have an existing URL
  useEffect(() => {
    if (existingRecordingUrl) {
      setAudioUrl(existingRecordingUrl);
      
      // Create audio element for playback control
      if (!audioRef.current) {
        audioRef.current = new Audio(existingRecordingUrl);
        
        // Set up event listeners
        audioRef.current.addEventListener('ended', () => {
          setIsPlaying(false);
          setCurrentTime(0);
        });
        
        audioRef.current.addEventListener('timeupdate', () => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        });
        
        audioRef.current.addEventListener('loadedmetadata', () => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration);
          }
        });
        
        // Load the audio
        audioRef.current.load();
      }
    }
    
    // Clean up on component unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [existingRecordingUrl]);
  
  // Upload recording mutation
  const uploadRecordingMutation = useMutation({
    mutationFn: async (blob: Blob) => {
      // Create form data for upload
      const formData = new FormData();
      formData.append('recording', blob, `call_${callId}_recording.wav`);
      
      const response = await fetch(`/api/call-logs/${callId}/recording`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload recording');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: t('callLogs.recording.uploadSuccess'),
        description: t('callLogs.recording.uploadSuccessDescription'),
      });
      
      // Update the audio URL with the one from the server
      setAudioUrl(data.recordingUrl);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/call-logs/${callId}`] });
      
      // Call the parent callback if provided
      if (onRecordingComplete) {
        onRecordingComplete(data.recordingUrl);
      }
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('callLogs.recording.uploadError'),
        variant: 'destructive',
      });
    },
  });
  
  // Delete recording mutation
  const deleteRecordingMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/call-logs/${callId}/recording`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete recording');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('callLogs.recording.deleteSuccess'),
        description: t('callLogs.recording.deleteSuccessDescription'),
      });
      
      // Reset state
      setAudioUrl(null);
      setAudioBlob(null);
      
      // Stop and reset audio player
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
      }
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/call-logs/${callId}`] });
      
      // Call the parent callback if provided
      if (onRecordingDeleted) {
        onRecordingDeleted();
      }
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('callLogs.recording.deleteError'),
        variant: 'destructive',
      });
    },
  });
  
  // Start recording function
  const startRecording = async () => {
    try {
      // Request audio permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream);
      recorderRef.current = mediaRecorder;
      
      // Set up event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        // Create blob from chunks
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        
        // Create URL for the blob
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        // Reset chunks
        audioChunksRef.current = [];
        
        // Create audio element for playback
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.load();
        } else {
          audioRef.current = new Audio(url);
          
          // Set up event listeners
          audioRef.current.addEventListener('ended', () => {
            setIsPlaying(false);
            setCurrentTime(0);
          });
          
          audioRef.current.addEventListener('timeupdate', () => {
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime);
            }
          });
          
          audioRef.current.addEventListener('loadedmetadata', () => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration);
            }
          });
        }
        
        toast({
          title: t('callLogs.recording.recordingComplete'),
          description: t('callLogs.recording.recordingCompleteDescription'),
        });
      };
      
      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      
      // Set up a timer to track recording duration
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prevTime) => prevTime + 1);
      }, 1000);
      
      toast({
        title: t('callLogs.recording.recordingStarted'),
        description: t('callLogs.recording.recordingStartedDescription'),
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: t('common.error'),
        description: t('callLogs.recording.microphoneAccessError'),
        variant: 'destructive',
      });
    }
  };
  
  // Stop recording function
  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
      
      // Stop all tracks in the stream
      recorderRef.current.stream.getTracks().forEach(track => track.stop());
      
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      setIsRecording(false);
    }
  };
  
  // Upload recording function
  const uploadRecording = () => {
    if (audioBlob) {
      uploadRecordingMutation.mutate(audioBlob);
    } else {
      toast({
        title: t('common.error'),
        description: t('callLogs.recording.noRecordingToUpload'),
        variant: 'destructive',
      });
    }
  };
  
  // Handle delete button click
  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };
  
  // Handle delete confirmation
  const confirmDelete = () => {
    deleteRecordingMutation.mutate();
    setDeleteDialogOpen(false);
  };
  
  // Toggle playback
  const togglePlayback = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    
    setIsPlaying(!isPlaying);
  };
  
  // Format time in MM:SS format
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Handle volume change
  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    
    // Toggle muted state based on volume
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };
  
  // Toggle mute
  const toggleMute = () => {
    if (!audioRef.current) return;
    
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    
    if (newMutedState) {
      // Store current volume before muting
      audioRef.current.volume = 0;
    } else {
      // Restore volume
      audioRef.current.volume = volume;
    }
  };
  
  // Handle seeking
  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return;
    
    const newTime = value[0];
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };
  
  // Download recording
  const downloadRecording = () => {
    if (!audioUrl) return;
    
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `call_${callId}_recording.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  
  if (mode === 'create' && !audioUrl) {
    return (
      <div className="bg-muted/30 border rounded-md p-4">
        <div className="mb-4">
          <h3 className="text-md font-medium flex items-center">
            <Mic className="h-4 w-4 mr-2" />
            {t('callLogs.recording.title')}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t('callLogs.recording.description')}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {!isRecording ? (
            <Button 
              onClick={startRecording} 
              variant="default" 
              className="bg-red-600 hover:bg-red-700"
            >
              <Mic className="h-4 w-4 mr-2" />
              {t('callLogs.recording.startRecording')}
            </Button>
          ) : (
            <>
              <Button onClick={stopRecording} variant="destructive">
                <StopCircle className="h-4 w-4 mr-2" />
                {t('callLogs.recording.stopRecording')}
              </Button>
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-2 text-red-500" />
                <span className="text-sm">{formatTime(recordingTime)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
  
  if (audioUrl) {
    return (
      <div className="bg-muted/30 border rounded-md p-4">
        <div className="mb-4">
          <h3 className="text-md font-medium flex items-center">
            <Mic className="h-4 w-4 mr-2" />
            {mode === 'create' 
              ? t('callLogs.recording.reviewRecording')
              : t('callLogs.recording.playbackTitle')
            }
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === 'create'
              ? t('callLogs.recording.reviewDescription')
              : t('callLogs.recording.playbackDescription')
            }
          </p>
        </div>
        
        <div className="space-y-4">
          {/* Playback controls */}
          <div className="flex items-center gap-3">
            <Button 
              onClick={togglePlayback} 
              variant="outline" 
              size="sm"
              className="h-8 w-8 p-0"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            
            <div className="grow">
              <Slider
                value={[currentTime]}
                min={0}
                max={duration || 100}
                step={0.1}
                onValueChange={handleSeek}
              />
            </div>
            
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
          
          {/* Volume controls */}
          <div className="flex items-center gap-3">
            <Button 
              onClick={toggleMute}
              variant="ghost" 
              size="sm"
              className="h-8 w-8 p-0"
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            
            <div className="w-24">
              <Slider
                value={[isMuted ? 0 : volume]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
              />
            </div>
            
            <div className="grow"></div>
            
            {/* Download button */}
            <Button 
              onClick={downloadRecording}
              variant="ghost" 
              size="sm"
              className="h-8"
            >
              <Download className="h-4 w-4 mr-2" />
              {t('callLogs.recording.download')}
            </Button>
            
            {/* Upload or Delete button */}
            {mode === 'create' && !uploadRecordingMutation.isPending && (
              <Button 
                onClick={uploadRecording}
                variant="default" 
                size="sm"
                className="h-8"
              >
                <Upload className="h-4 w-4 mr-2" />
                {t('callLogs.recording.upload')}
              </Button>
            )}
            
            {mode === 'view' && (
              <Button
                onClick={handleDeleteClick}
                variant="destructive"
                size="sm"
                className="h-8"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('callLogs.recording.delete')}
              </Button>
            )}
            
            {uploadRecordingMutation.isPending && (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span className="text-xs">{t('common.uploading')}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Delete confirmation dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('callLogs.recording.confirmDelete')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('callLogs.recording.confirmDeleteDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                {t('common.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }
  
  // Default state (view mode with no recording)
  return (
    <div className="bg-muted/30 border rounded-md p-4">
      <div className="mb-4">
        <h3 className="text-md font-medium flex items-center">
          <Mic className="h-4 w-4 mr-2" />
          {t('callLogs.recording.noRecording')}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t('callLogs.recording.noRecordingDescription')}
        </p>
      </div>
      
      {mode === 'create' && (
        <Button 
          onClick={startRecording} 
          variant="default"
        >
          <Mic className="h-4 w-4 mr-2" />
          {t('callLogs.recording.startRecording')}
        </Button>
      )}
    </div>
  );
};

export default CallRecording;