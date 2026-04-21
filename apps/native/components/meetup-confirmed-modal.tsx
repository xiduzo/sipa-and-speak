import { Button } from "heroui-native";
import { Modal, Text, View } from "react-native";

interface Props {
  visible: boolean;
  venueName: string;
  date: string;
  time: string;
  onDismiss: () => void;
}

export function MeetupConfirmedModal({ visible, venueName, date, time, onDismiss }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View className="flex-1 bg-background items-center justify-center px-8 gap-6">
        <Text className="text-6xl">📅</Text>
        <Text className="text-foreground text-3xl font-bold text-center">
          Meetup confirmed!
        </Text>
        <View className="bg-muted rounded-2xl px-6 py-5 w-full gap-2">
          <View className="flex-row items-center gap-2">
            <Text className="text-muted-foreground text-sm w-16">Where</Text>
            <Text testID="confirmed-venue" className="text-foreground font-semibold flex-1">
              {venueName}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Text className="text-muted-foreground text-sm w-16">When</Text>
            <Text testID="confirmed-datetime" className="text-foreground font-semibold flex-1">
              {date} at {time}
            </Text>
          </View>
        </View>
        <Text className="text-muted-foreground text-center">
          You'll both receive a reminder closer to the time.
        </Text>
        <Button testID="meetup-confirmed-dismiss-btn" variant="primary" className="w-full" onPress={onDismiss}>
          <Button.Label>Got it</Button.Label>
        </Button>
      </View>
    </Modal>
  );
}
